"""
Tests for persistent investigations, alert review status, audit trail, and SHA-256 integrity checks.
"""

from __future__ import annotations

import hashlib
import io
import pytest
from httpx import AsyncClient

from app.models.alert import Alert, AlertStatus, Severity
from app.models.investigation import Investigation, InvestigationStatus
from app.models.log_file import LogFile, LogFormat, LogStatus


@pytest.mark.asyncio
async def test_alert_review_status_lifecycle_and_audit(client: AsyncClient, db_session):
    """Analysts can review alerts and set statuses: New, Under Review, Benign, Confirmed Incident with audit logging."""
    # 1. Create a log file and an alert in the database
    log = LogFile(
        filename="auth_test.csv",
        original_filename="auth_test.csv",
        sha256="a" * 64,
        size_bytes=1000,
        format=LogFormat.CSV,
        line_count=10,
        status=LogStatus.READY,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    alert = Alert(
        log_file_id=log.id,
        rule_name="Brute Force Detection",
        rule_id="RULE-001",
        severity=Severity.HIGH,
        status=AlertStatus.NEW,
        description="5 failed logins from 192.168.1.100",
        affected_entity="IP: 192.168.1.100",
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    # Verify initial status is New
    res = await client.get(f"/api/v1/alerts/{alert.id}")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "New"
    assert data["analyst_notes"] is None

    # 2. Update status to 'Under Review' with notes
    res = await client.patch(
        f"/api/v1/alerts/{alert.id}",
        json={"status": "Under Review", "analyst_notes": "Triage started by SOC analyst"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "Under Review"
    assert data["analyst_notes"] == "Triage started by SOC analyst"

    # 3. Update status to 'Confirmed Incident'
    res = await client.patch(
        f"/api/v1/alerts/{alert.id}",
        json={"status": "Confirmed Incident", "analyst_notes": "Host compromised. Escalating."},
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "Confirmed Incident"

    # 4. Verify audit trail reflects the alert reviews
    res = await client.get("/api/v1/audit", params={"entity_type": "alert"})
    assert res.status_code == 200
    records = res.json()["data"]
    assert len(records) >= 2
    assert any("Under Review" in r["detail"] for r in records)
    assert any("Confirmed Incident" in r["detail"] for r in records)


@pytest.mark.asyncio
async def test_investigation_alert_grouping_and_audit(client: AsyncClient, db_session):
    """Test creating an investigation, grouping alerts, unlinking, and retrieving audit records."""
    log = LogFile(
        filename="syslog.csv",
        original_filename="syslog.csv",
        sha256="b" * 64,
        size_bytes=500,
        format=LogFormat.CSV,
        line_count=5,
        status=LogStatus.READY,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    a1 = Alert(
        log_file_id=log.id,
        rule_name="Privilege Escalation",
        rule_id="RULE-002",
        severity=Severity.CRITICAL,
        description="Sudo to root by user www-data",
        affected_entity="User: www-data",
    )
    a2 = Alert(
        log_file_id=log.id,
        rule_name="Unusual Burst",
        rule_id="RULE-005",
        severity=Severity.HIGH,
        description="Burst of 50 events in 3 seconds",
        affected_entity="IP: 10.0.0.5",
    )
    db_session.add_all([a1, a2])
    await db_session.commit()
    await db_session.refresh(a1)
    await db_session.refresh(a2)

    # 1. Create Investigation
    inv_res = await client.post(
        "/api/v1/investigations",
        json={"title": "Web Server Breach Investigation", "notes": "Initial threat hunting case"},
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["data"]["id"]
    assert inv_res.json()["data"]["alert_count"] == 0

    # 2. Group alerts under this investigation
    group_res = await client.post(
        f"/api/v1/investigations/{inv_id}/alerts",
        json={"alert_ids": [a1.id, a2.id]},
    )
    assert group_res.status_code == 200
    assert group_res.json()["data"]["alert_count"] == 2

    # 3. Retrieve linked alerts
    alerts_res = await client.get(f"/api/v1/investigations/{inv_id}/alerts")
    assert alerts_res.status_code == 200
    linked = alerts_res.json()["data"]
    assert len(linked) == 2
    assert {a["id"] for a in linked} == {a1.id, a2.id}

    # 4. Check investigation audit trail
    audit_res = await client.get(f"/api/v1/investigations/{inv_id}/audit")
    assert audit_res.status_code == 200
    audit_trail = audit_res.json()["data"]
    actions = [r["action"] for r in audit_trail]
    assert "investigation_created" in actions
    assert "alerts_grouped" in actions

    # 5. Remove one alert
    unlink_res = await client.delete(f"/api/v1/investigations/{inv_id}/alerts/{a1.id}")
    assert unlink_res.status_code == 200
    assert unlink_res.json()["data"]["alert_count"] == 1


@pytest.mark.asyncio
async def test_sha256_file_integrity_verification_match_and_mismatch(client: AsyncClient):
    """Calculate SHA-256 from original bytes and compare against reference hash with explanation."""
    test_bytes = b"timestamp,source_ip,user,action\n2026-10-28T02:00:00Z,10.0.0.1,admin,login_success\n"
    actual_sha256 = hashlib.sha256(test_bytes).hexdigest()
    mismatch_sha256 = "0" * 64

    # 1. Verification with matching hash
    match_res = await client.post(
        "/api/v1/integrity/verify-file",
        files={"file": ("secure_evidence.csv", io.BytesIO(test_bytes), "text/csv")},
        data={"reference_hash": actual_sha256},
    )
    assert match_res.status_code == 200
    data = match_res.json()["data"]
    assert data["matched"] is True
    assert data["calculated_hash"] == actual_sha256
    assert data["reference_hash"] == actual_sha256
    assert data["file_size_bytes"] == len(test_bytes)
    assert "Matching hashes prove equality to the reference, not the original file's authenticity." in data["explanation"]

    # 2. Verification with mismatch hash
    mismatch_res = await client.post(
        "/api/v1/integrity/verify-file",
        files={"file": ("tampered_evidence.csv", io.BytesIO(test_bytes), "text/csv")},
        data={"reference_hash": mismatch_sha256},
    )
    assert mismatch_res.status_code == 200
    data = mismatch_res.json()["data"]
    assert data["matched"] is False
    assert data["calculated_hash"] == actual_sha256
    assert data["reference_hash"] == mismatch_sha256

    # 3. Malformed hash validation (not 64 hex chars)
    invalid_hash_res = await client.post(
        "/api/v1/integrity/verify-file",
        files={"file": ("evidence.csv", io.BytesIO(test_bytes), "text/csv")},
        data={"reference_hash": "not-a-valid-sha256"},
    )
    assert invalid_hash_res.status_code == 422


@pytest.mark.asyncio
async def test_stored_log_integrity_verification(client: AsyncClient, db_session):
    """Verify stored log archive integrity from disk bytes."""
    log_content = b"sample log content for integrity check"
    calc_hash = hashlib.sha256(log_content).hexdigest()

    log = LogFile(
        filename="integrity_test.csv",
        original_filename="integrity_test.csv",
        sha256=calc_hash,
        size_bytes=len(log_content),
        format=LogFormat.CSV,
        line_count=1,
        status=LogStatus.READY,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    # Verify log against stored hash
    res = await client.post(f"/api/v1/integrity/verify-log/{log.id}")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["matched"] is True
    assert data["calculated_hash"] == calc_hash
    assert data["reference_hash"] == calc_hash
    assert "Matching hashes prove equality to the reference" in data["explanation"]
