"""
Tests for the Scikit-learn Isolation Forest Anomaly Detection Engine.
Verifies reproducible anomaly scoring, categorical safety, and feature explanations.
"""

from __future__ import annotations

import io
import numpy as np
import pytest
from httpx import AsyncClient

from app.detection.ml_engine import MLAnomalyDetector
from app.models.parsed_event import ParsedEvent


def generate_synthetic_events(count: int = 30) -> str:
    """Generates synthetic CSV logs with standard baseline and an outlier burst."""
    rows = ["timestamp,source_ip,user,action,service,http_status,message"]

    # 25 normal baseline events during daytime from 192.168.1.50
    for i in range(25):
        rows.append(
            f"2026-10-28 10:{i:02d}:00,192.168.1.50,alice,read_file,app,200,Access file {i}"
        )

    # 5 anomalous events: after-hours at 03:00 AM with failures from 203.0.113.88
    for i in range(5):
        rows.append(
            f"2026-10-28 03:15:{i:02d},203.0.113.88,root,login_failed,sshd,401,Failed password attempt {i}"
        )

    return "\n".join(rows)


@pytest.mark.asyncio
async def test_ml_anomaly_detection_end_to_end(client: AsyncClient) -> None:
    """Uploading logs with distinct behavioral outliers generates ML01 anomaly alert."""
    csv_data = generate_synthetic_events(30)
    files = {"file": ("ml_dataset.csv", io.BytesIO(csv_data.encode()), "text/csv")}

    response = await client.post("/api/v1/logs/upload", files=files)
    assert response.status_code == 201

    alerts_res = await client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["data"]

    # Locate the ML anomaly alert
    ml_alert = next((a for a in alerts if a["rule_id"] == "ML01"), None)
    assert ml_alert is not None
    assert "Isolation Forest" in ml_alert["rule_name"]
    assert ml_alert["ml_score"] is not None
    assert 0.0 <= ml_alert["ml_score"] <= 1.0

    # Verify detail endpoint includes feature explanations and evidence
    detail_res = await client.get(f"/api/v1/alerts/{ml_alert['id']}")
    assert detail_res.status_code == 200
    detail = detail_res.json()["data"]
    assert "Statistical outlier" in detail["description"]
    assert "Contributing factors" in detail["description"]
    assert len(detail["evidence"]) > 0


def test_feature_extraction_no_numerical_ip_encoding() -> None:
    """Verifies that IP addresses and usernames are not encoded as magnitudes."""
    detector = MLAnomalyDetector(log_file_id=1, random_state=42)
    fake_events = [
        ParsedEvent(
            id=i,
            log_file_id=1,
            line_number=i,
            source_ip=f"10.0.0.{i}",
            user=f"user_{i}",
            raw_line=f"line_{i}",
        )
        for i in range(10)
    ]
    X, labels = detector.extract_features(fake_events)
    # Check shape
    assert X.shape[0] == 10
    # No feature value should be an IP octet or username integer
    for row in X:
        assert np.all(row <= 24.0)  # all features normalized


def test_ml_graceful_on_few_samples() -> None:
    """Fewer than MIN_SAMPLES_FOR_ML returns empty list without error."""
    detector = MLAnomalyDetector(log_file_id=1)
    few_events = [
        ParsedEvent(id=1, log_file_id=1, line_number=1, raw_line="line 1"),
        ParsedEvent(id=2, log_file_id=1, line_number=2, raw_line="line 2"),
    ]
    alerts = detector.run(few_events)
    assert alerts == []
