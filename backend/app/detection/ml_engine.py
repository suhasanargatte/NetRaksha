"""
Unsupervised Anomaly Detection Engine using Scikit-Learn Isolation Forest.
Extracts behavioral features without encoding identities as magnitudes,
ensures reproducible results, and provides feature-level anomaly explanations.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest

from app.config import get_settings
from app.detection.engine import is_failed_login, is_privilege_escalation
from app.models.alert import Alert, Severity
from app.models.parsed_event import ParsedEvent

log = logging.getLogger(__name__)

FEATURE_NAMES = [
    "hour_of_day",
    "is_weekend",
    "is_after_hours",
    "is_auth_failure",
    "is_privilege_action",
    "entity_frequency",
    "inter_event_delay",
    "is_http_error",
]

MIN_SAMPLES_FOR_ML = 5


class MLAnomalyDetector:
    """Trains an in-memory Isolation Forest on ingested log events."""

    def __init__(self, log_file_id: int, random_state: int = 42) -> None:
        self.log_file_id = log_file_id
        self.random_state = random_state
        self.settings = get_settings()

    def extract_features(
        self, events: List[ParsedEvent]
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Extract numerical and behavioral frequency features from parsed events.
        Never encodes usernames or IP addresses as numerical magnitudes.
        """
        # Calculate entity frequency counts
        entity_counts: Counter[str] = Counter()
        for e in events:
            key = e.source_ip or e.user or "global"
            entity_counts[key] += 1

        total_events = max(1, len(events))
        features_matrix: List[List[float]] = []
        entity_labels: List[str] = []

        # Sort chronologically to compute inter-event delay
        sorted_events = sorted(
            events,
            key=lambda ev: (ev.timestamp or datetime.min, ev.line_number)
        )

        last_entity_time: Dict[str, datetime] = {}

        for e in sorted_events:
            entity_key = e.source_ip or e.user or "host"
            entity_labels.append(entity_key)

            # 1. Hour of day (normalized 0-1)
            hour_val = (e.timestamp.hour / 24.0) if e.timestamp else 0.5

            # 2. Weekend indicator
            is_weekend = 1.0 if (e.timestamp and e.timestamp.weekday() >= 5) else 0.0

            # 3. After hours (before 07:00 or after 20:00)
            is_after_hours = 0.0
            if e.timestamp:
                h = e.timestamp.hour
                if h < self.settings.rule_after_hours_start or h >= self.settings.rule_after_hours_end:
                    is_after_hours = 1.0

            # 4. Auth failure
            is_failure = 1.0 if is_failed_login(e) else 0.0

            # 5. Privilege action
            is_priv = 1.0 if is_privilege_escalation(e) else 0.0

            # 6. Entity frequency (proportion of overall log volume)
            freq_ratio = entity_counts[entity_key] / total_events

            # 7. Inter-event delay in seconds (capped at 1 hour = 3600s, normalized)
            delay_sec = 3600.0
            if e.timestamp and entity_key in last_entity_time:
                diff = abs((e.timestamp - last_entity_time[entity_key]).total_seconds())
                delay_sec = min(3600.0, diff)
            if e.timestamp:
                last_entity_time[entity_key] = e.timestamp
            norm_delay = delay_sec / 3600.0

            # 8. HTTP error code
            is_http_err = 1.0 if (e.http_status and e.http_status >= 400) else 0.0

            features_matrix.append([
                hour_val,
                is_weekend,
                is_after_hours,
                is_failure,
                is_priv,
                freq_ratio,
                norm_delay,
                is_http_err,
            ])

        return np.array(features_matrix, dtype=np.float64), entity_labels

    def run(self, events: List[ParsedEvent]) -> List[Alert]:
        """
        Execute Isolation Forest anomaly detection safely.
        Never breaks the caller if ML encounters degenerate inputs.
        """
        if len(events) < MIN_SAMPLES_FOR_ML:
            log.info(
                "Skipping ML anomaly detection for log %d: insufficient records (%d < %d)",
                self.log_file_id, len(events), MIN_SAMPLES_FOR_ML
            )
            return []

        try:
            X, entity_labels = self.extract_features(events)
            if X.shape[0] < MIN_SAMPLES_FOR_ML:
                return []

            # Deterministic Isolation Forest
            clf = IsolationForest(
                n_estimators=100,
                contamination=self.settings.ml_contamination,
                random_state=self.random_state,
            )
            clf.fit(X)

            # decision_function: lower/negative = more anomalous
            raw_scores = clf.decision_function(X)

            # Normalise anomaly score to [0.0, 1.0] where 1.0 is most anomalous
            min_score, max_score = np.min(raw_scores), np.max(raw_scores)
            if max_score > min_score:
                # Invert so lower decision_function yields higher anomaly score
                anomaly_scores = (max_score - raw_scores) / (max_score - min_score)
            else:
                anomaly_scores = np.zeros_like(raw_scores)

            # Compute feature medians to explain anomalies
            feature_medians = np.median(X, axis=0)

            threshold = self.settings.ml_anomaly_threshold
            anomalous_indices = np.where(anomaly_scores >= threshold)[0]

            if len(anomalous_indices) == 0:
                return []

            # Group anomalous events by entity
            entity_anomalies: Dict[str, List[Tuple[int, float]]] = {}
            for idx in anomalous_indices:
                ent = entity_labels[idx]
                score = float(anomaly_scores[idx])
                if ent not in entity_anomalies:
                    entity_anomalies[ent] = []
                entity_anomalies[ent].append((idx, score))

            alerts: List[Alert] = []

            for ent, scored_items in entity_anomalies.items():
                # Pick event with the highest anomaly score in this entity group
                best_idx, max_score = max(scored_items, key=lambda item: item[1])
                rep_event = events[best_idx]

                # Identify the top 2 features with highest absolute deviation from median
                deviations = np.abs(X[best_idx] - feature_medians)
                top_feature_indices = np.argsort(deviations)[::-1][:2]

                factor_descriptions = []
                for f_idx in top_feature_indices:
                    name = FEATURE_NAMES[f_idx]
                    val = X[best_idx][f_idx]
                    med = feature_medians[f_idx]
                    if name == "is_after_hours" and val > 0:
                        factor_descriptions.append("occurred outside standard operating hours")
                    elif name == "is_auth_failure" and val > 0:
                        factor_descriptions.append("multiple authentication failure indicators")
                    elif name == "entity_frequency" and val > med:
                        factor_descriptions.append("elevated event frequency volume")
                    elif name == "inter_event_delay" and val < med:
                        factor_descriptions.append("rapid sequence timing")
                    elif name == "is_privilege_action" and val > 0:
                        factor_descriptions.append("sensitive administrative execution")
                    else:
                        factor_descriptions.append(f"{name} deviation ({val:.2f} vs median {med:.2f})")

                explanation = (
                    f"Statistical outlier identified via Isolation Forest (score: {max_score:.2f}). "
                    f"Contributing factors: {'; '.join(factor_descriptions)}."
                )

                # Collect supporting evidence
                evidence = [
                    {
                        "event_id": events[idx].id,
                        "line_number": events[idx].line_number,
                        "raw_line": events[idx].raw_line,
                        "reason": f"Anomaly score: {score:.2f}",
                    }
                    for idx, score in scored_items[:10]
                ]

                severity = Severity.HIGH if max_score >= 0.85 else Severity.MEDIUM

                alert = Alert(
                    log_file_id=self.log_file_id,
                    rule_id="ML01",
                    rule_name="Statistical Anomaly (Isolation Forest)",
                    severity=severity,
                    affected_entity=f"Entity: {ent}",
                    timestamp=rep_event.timestamp or datetime.utcnow(),
                    description=explanation,
                    evidence_json=json.dumps(evidence),
                    ml_score=round(max_score, 3),
                )
                alerts.append(alert)

            return alerts

        except Exception as exc:
            # Fallback gracefully so log upload and rule detection never fail
            log.warning(
                "Isolation Forest anomaly detection failed on log file %d: %s",
                self.log_file_id, exc, exc_info=True
            )
            return []

