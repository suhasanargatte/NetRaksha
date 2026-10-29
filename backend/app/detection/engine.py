"""
Rule-Based Security Detection Engine for NetRakshak.
Analyzes parsed log events to identify verifiable security patterns,
prevent duplicate alerts, and link concrete forensic evidence.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from app.config import get_settings
from app.models.alert import Alert, Severity
from app.models.parsed_event import ParsedEvent


FAILED_LOGIN_KEYWORDS = {
    "failed", "failure", "fail", "invalid", "denied", "login_failed",
    "authentication failure", "bad password", "rejected"
}

SUCCESS_LOGIN_KEYWORDS = {
    "accepted", "success", "login_success", "authenticated",
    "session opened", "successful login", "access granted"
}

PRIVILEGE_KEYWORDS = {
    "sudo", "su:", "pkexec", "privilege_escalation", "chmod 777",
    "visudo", "setuid", "root shell", "escalation", "chown root"
}


def is_failed_login(event: ParsedEvent) -> bool:
    """Check if parsed event indicates an authentication failure."""
    action = (event.action or "").lower()
    msg = (event.message or "").lower()
    raw = (event.raw_line or "").lower()

    if any(k in action for k in FAILED_LOGIN_KEYWORDS):
        return True
    if any(k in msg for k in FAILED_LOGIN_KEYWORDS):
        return True
    if "failed password" in raw or "authentication failure" in raw or "invalid user" in raw:
        return True
    return False


def is_success_login(event: ParsedEvent) -> bool:
    """Check if parsed event indicates a successful authentication."""
    action = (event.action or "").lower()
    msg = (event.message or "").lower()
    raw = (event.raw_line or "").lower()

    if any(k in action for k in SUCCESS_LOGIN_KEYWORDS):
        return True
    if any(k in msg for k in SUCCESS_LOGIN_KEYWORDS):
        return True
    if "accepted password" in raw or "accepted publickey" in raw or "session opened for user" in raw:
        return True
    return False


def is_privilege_escalation(event: ParsedEvent) -> bool:
    """Check if parsed event indicates privilege escalation or execution."""
    action = (event.action or "").lower()
    service = (event.service or "").lower()
    msg = (event.message or "").lower()
    raw = (event.raw_line or "").lower()

    if service in {"sudo", "su", "pkexec"}:
        return True
    if any(k in action for k in PRIVILEGE_KEYWORDS):
        return True
    if any(k in msg for k in PRIVILEGE_KEYWORDS):
        return True
    if "sudo:" in raw or "COMMAND=/bin/" in raw or "COMMAND=/usr/bin/" in raw:
        return True
    return False


class DetectionEngine:
    """Executes deterministic security detection rules over a batch of parsed events."""

    def __init__(self, log_file_id: int) -> None:
        self.log_file_id = log_file_id
        self.settings = get_settings()

    def run(self, events: List[ParsedEvent]) -> List[Alert]:
        """
        Evaluate all detection rules against parsed events.

        Returns
        -------
        List[Alert]
            De-duplicated, evidence-backed security alerts.
        """
        if not events:
            return []

        # Sort events chronologically if timestamps are present, otherwise by line number
        sorted_events = sorted(
            events,
            key=lambda e: (e.timestamp or datetime.min, e.line_number)
        )

        alerts: List[Alert] = []
        alert_keys: Set[Tuple[str, str]] = set()

        def add_alert(alert: Alert) -> None:
            # Deduplicate by (rule_id, affected_entity) per log file
            key = (alert.rule_id, alert.affected_entity or "global")
            if key not in alert_keys:
                alert_keys.add(key)
                alerts.append(alert)

        # ── Rule 1: Repeated Failed Logins (Brute Force) ─────────────────────
        self._detect_brute_force(sorted_events, add_alert)

        # ── Rule 2: Failed Logins Followed by Success ─────────────────────────
        self._detect_failed_then_success(sorted_events, add_alert)

        # ── Rule 3: Unusual Event Bursts ──────────────────────────────────────
        self._detect_event_bursts(sorted_events, add_alert)

        # ── Rule 4: Configurable After-Hours Activity ─────────────────────────
        self._detect_after_hours(sorted_events, add_alert)

        # ── Rule 5: Privilege Escalation & Sensitive Execution ────────────────
        self._detect_privilege_changes(sorted_events, add_alert)

        return alerts

    def _detect_brute_force(
        self,
        events: List[ParsedEvent],
        add_alert: Any
    ) -> None:
        """Rule R01: Detects multiple failed authentication attempts from same IP/user."""
        threshold = self.settings.rule_brute_force_threshold
        failures_by_entity: Dict[str, List[ParsedEvent]] = defaultdict(list)

        for event in events:
            if is_failed_login(event):
                # Prefer source IP, fallback to user
                entity = event.source_ip or (f"User:{event.user}" if event.user else None)
                if entity:
                    failures_by_entity[entity].append(event)

        for entity, fail_events in failures_by_entity.items():
            if len(fail_events) >= threshold:
                evidence = [
                    {
                        "event_id": e.id,
                        "line_number": e.line_number,
                        "raw_line": e.raw_line,
                        "reason": f"Authentication failure for user '{e.user or 'unknown'}'",
                    }
                    for e in fail_events[:20]  # Cap evidence list at 20 lines
                ]
                severity = Severity.CRITICAL if len(fail_events) >= 10 else Severity.HIGH
                latest_ts = max((e.timestamp for e in fail_events if e.timestamp), default=datetime.utcnow())

                alert = Alert(
                    log_file_id=self.log_file_id,
                    rule_id="R01",
                    rule_name="Brute Force Authentication",
                    severity=severity,
                    affected_entity=entity,
                    timestamp=latest_ts,
                    description=(
                        f"Detected {len(fail_events)} authentication failures for {entity}. "
                        f"Exceeds brute force threshold of {threshold} attempts."
                    ),
                    evidence_json=json.dumps(evidence),
                )
                add_alert(alert)

    def _detect_failed_then_success(
        self,
        events: List[ParsedEvent],
        add_alert: Any
    ) -> None:
        """Rule R02: Detects failed authentication followed by a successful login."""
        threshold = self.settings.rule_failed_then_success_threshold
        failures_by_user: Dict[str, List[ParsedEvent]] = defaultdict(list)

        for event in events:
            user = event.user or "root"
            if is_failed_login(event):
                failures_by_user[user].append(event)
            elif is_success_login(event):
                # Check if there were prior failures for this user
                prior_failures = failures_by_user.get(user, [])
                if len(prior_failures) >= threshold:
                    evidence = [
                        {
                            "event_id": e.id,
                            "line_number": e.line_number,
                            "raw_line": e.raw_line,
                            "reason": "Failed login attempt",
                        }
                        for e in prior_failures[:10]
                    ]
                    # Append the successful event as key forensic evidence
                    evidence.append({
                        "event_id": event.id,
                        "line_number": event.line_number,
                        "raw_line": event.raw_line,
                        "reason": "Subsequent successful authentication",
                    })

                    entity_label = f"User: {user}" + (f" (IP: {event.source_ip})" if event.source_ip else "")
                    alert = Alert(
                        log_file_id=self.log_file_id,
                        rule_id="R02",
                        rule_name="Compromised Account (Brute Force Success)",
                        severity=Severity.CRITICAL,
                        affected_entity=entity_label,
                        timestamp=event.timestamp or datetime.utcnow(),
                        description=(
                            f"Account '{user}' successfully logged in after {len(prior_failures)} "
                            f"failed attempts. Potential brute force compromise."
                        ),
                        evidence_json=json.dumps(evidence),
                    )
                    add_alert(alert)
                    # Reset failure count for this user
                    failures_by_user[user] = []

    def _detect_event_bursts(
        self,
        events: List[ParsedEvent],
        add_alert: Any
    ) -> None:
        """Rule R03: Detects unusual volume bursts from an IP or user."""
        threshold = self.settings.rule_burst_threshold
        window_seconds = self.settings.rule_burst_window_seconds

        events_by_source: Dict[str, List[ParsedEvent]] = defaultdict(list)
        for e in events:
            if e.source_ip and e.timestamp:
                events_by_source[e.source_ip].append(e)

        for source_ip, ip_events in events_by_source.items():
            if len(ip_events) < threshold:
                continue

            # Sliding window check
            burst_found: List[ParsedEvent] = []
            for i in range(len(ip_events)):
                current_window = [
                    e for e in ip_events[i:]
                    if (e.timestamp - ip_events[i].timestamp).total_seconds() <= window_seconds
                ]
                if len(current_window) >= threshold and len(current_window) > len(burst_found):
                    burst_found = current_window

            if burst_found:
                evidence = [
                    {
                        "event_id": e.id,
                        "line_number": e.line_number,
                        "raw_line": e.raw_line,
                        "reason": f"Burst event at {e.timestamp}",
                    }
                    for e in burst_found[:15]
                ]
                alert = Alert(
                    log_file_id=self.log_file_id,
                    rule_id="R03",
                    rule_name="Unusual Event Burst",
                    severity=Severity.MEDIUM,
                    affected_entity=f"IP: {source_ip}",
                    timestamp=burst_found[0].timestamp,
                    description=(
                        f"Unusual event burst detected from {source_ip}: {len(burst_found)} events "
                        f"within {window_seconds}s (threshold: {threshold})."
                    ),
                    evidence_json=json.dumps(evidence),
                )
                add_alert(alert)

    def _detect_after_hours(
        self,
        events: List[ParsedEvent],
        add_alert: Any
    ) -> None:
        """Rule R04: Detects sensitive security actions outside business hours."""
        start_hour = self.settings.rule_after_hours_start
        end_hour = self.settings.rule_after_hours_end

        after_hours_events: List[ParsedEvent] = []
        for e in events:
            if e.timestamp:
                hour = e.timestamp.hour
                if hour < start_hour or hour >= end_hour:
                    # Check if action is security-sensitive (login, sudo, etc.)
                    if is_success_login(e) or is_privilege_escalation(e) or e.user:
                        after_hours_events.append(e)

        if after_hours_events:
            for entity, group in self._group_by_entity(after_hours_events).items():
                evidence = [
                    {
                        "event_id": e.id,
                        "line_number": e.line_number,
                        "raw_line": e.raw_line,
                        "reason": f"Activity at {e.timestamp.strftime('%H:%M:%S UTC')} (after-hours)",
                    }
                    for e in group[:10]
                ]
                alert = Alert(
                    log_file_id=self.log_file_id,
                    rule_id="R04",
                    rule_name="After-Hours Activity",
                    severity=Severity.LOW,
                    affected_entity=entity,
                    timestamp=group[0].timestamp,
                    description=(
                        f"Detected {len(group)} after-hours actions for {entity} outside standard "
                        f"operating hours ({start_hour:02d}:00 - {end_hour:02d}:00 UTC)."
                    ),
                    evidence_json=json.dumps(evidence),
                )
                add_alert(alert)

    def _detect_privilege_changes(
        self,
        events: List[ParsedEvent],
        add_alert: Any
    ) -> None:
        """Rule R05: Detects sudo, su, or role escalation execution."""
        priv_events = [e for e in events if is_privilege_escalation(e)]
        if not priv_events:
            return

        for entity, group in self._group_by_entity(priv_events).items():
            evidence = [
                {
                    "event_id": e.id,
                    "line_number": e.line_number,
                    "raw_line": e.raw_line,
                    "reason": f"Privileged command: {e.action or e.message or 'escalation'}",
                }
                for e in group[:10]
            ]
            latest_ts = max((e.timestamp for e in group if e.timestamp), default=datetime.utcnow())

            alert = Alert(
                log_file_id=self.log_file_id,
                rule_id="R05",
                rule_name="Privilege Escalation Execution",
                severity=Severity.HIGH,
                affected_entity=entity,
                timestamp=latest_ts,
                description=(
                    f"Privilege escalation command executed by {entity} ({len(group)} event(s))."
                ),
                evidence_json=json.dumps(evidence),
            )
            add_alert(alert)

    def _group_by_entity(self, events: List[ParsedEvent]) -> Dict[str, List[ParsedEvent]]:
        """Helper to group events by (user or source_ip)."""
        grouped: Dict[str, List[ParsedEvent]] = defaultdict(list)
        for e in events:
            key = f"User: {e.user}" if e.user else (f"IP: {e.source_ip}" if e.source_ip else "Host")
            grouped[key].append(e)
        return grouped

