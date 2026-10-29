"""
End-to-End Workflow Integration Test for NetRakshak:
upload logs → detect threats → review alerts → investigate → verify file integrity → export report.
"""

from __future__ import annotations

import hashlib
import io
import pytest
from httpx import AsyncClient

SAMPLE_CSV = b"""timestamp,source_ip,user,action,service,http_method,http_status
2026-10-28T02:00:00Z,192.168.1.100,admin,login_failed,sshd,,
2026-10-28T02:00:30Z,192.168.1.100,admin,login_failed,sshd,,
2026-10-28T02:01:00Z,192.168.1.100,admin,login_failed,sshd,,
2026-10-28T02:01:30Z,192.168.1.100,admin,login_failed,sshd,,
2026-10-28T02:02:00Z,192.168.1.100,admin,login_success,sshd,,
"""


@pytest.mark.asyncio
async def test_complete_end_to_end_workflow(client: AsyncClient):
    # ── 1. Authentication: Register & Login Analyst ───────────────────────────
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "lead_analyst",
            "email": "lead@netrakshak.local",
            "password": "SecurePassword123!",
            "role": "analyst",
        },
    )
    assert reg_res.status_code == 201
    auth_data = reg_res.json()["data"]
    token = auth_data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify /me endpoint
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["data"]["username"] == "lead_analyst"

    # ── 2. Ingest Logs: Upload CSV and trigger analysis ───────────────────────
    upload_res = await client.post(
        "/api/v1/logs/upload",
        files={"file": ("incident_evidence.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    upload_data = upload_res.json()["data"]
    log_file_id = upload_data["log_file"]["id"]
    file_sha256 = upload_data["log_file"]["sha256"]
    assert upload_data["validation"]["valid_rows"] == 5
    assert file_sha256 == hashlib.sha256(SAMPLE_CSV).hexdigest()

    # ── 3. Detect Threats: Verify rule-based and ML alerts fired ───────────────
    alerts_res = await client.get("/api/v1/alerts", params={"log_file_id": log_file_id})
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["data"]
    assert len(alerts) > 0

    target_alert = alerts[0]
    alert_id = target_alert["id"]
    assert target_alert["status"] == "New"

    # ── 4. Review Alert: Update status and add analyst triage notes ───────────
    review_res = await client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={
            "status": "Confirmed Incident",
            "analyst_notes": "Brute force confirmed from IP 192.168.1.100 followed by unauthorized login.",
        },
    )
    assert review_res.status_code == 200
    reviewed_alert = review_res.json()["data"]
    assert reviewed_alert["status"] == "Confirmed Incident"
    assert "Brute force confirmed" in reviewed_alert["analyst_notes"]

    # ── 5. Investigate: Create case and group alerts ───────────────────────────
    inv_res = await client.post(
        "/api/v1/investigations",
        json={
            "title": "SSH Credential Stuffing & Unauthorized Ingress",
            "notes": "Targeted host SSH service breached. Isolating network segment.",
        },
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["data"]["id"]

    # Group alert under this investigation
    group_res = await client.post(
        f"/api/v1/investigations/{inv_id}/alerts",
        json={"alert_ids": [alert_id]},
    )
    assert group_res.status_code == 200
    assert group_res.json()["data"]["alert_count"] == 1

    # ── 6. Verify File Integrity: Check bytes against reference hash ───────────
    # A) Matching verification
    int_match_res = await client.post(
        "/api/v1/integrity/verify-file",
        files={"file": ("incident_evidence.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        data={"reference_hash": file_sha256},
    )
    assert int_match_res.status_code == 200
    match_data = int_match_res.json()["data"]
    assert match_data["matched"] is True
    assert match_data["calculated_hash"] == file_sha256
    assert "Matching hashes prove equality to the reference" in match_data["explanation"]

    # B) Mismatch verification
    int_mismatch_res = await client.post(
        "/api/v1/integrity/verify-file",
        files={"file": ("incident_evidence.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        data={"reference_hash": "f" * 64},
    )
    assert int_mismatch_res.status_code == 200
    assert int_mismatch_res.json()["data"]["matched"] is False

    # ── 7. Export Reports: Generate CSV and PDF dossiers ──────────────────────
    # A) CSV Export
    csv_rep_res = await client.get(f"/api/v1/reports/investigation/{inv_id}/csv")
    assert csv_rep_res.status_code == 200
    assert "text/csv" in csv_rep_res.headers["content-type"]
    csv_text = csv_rep_res.text
    assert "NETRAKSHAK INVESTIGATION DOSSIER" in csv_text
    assert "SSH Credential Stuffing" in csv_text
    assert "Confirmed Incident" in csv_text

    # B) PDF Export
    pdf_rep_res = await client.get(f"/api/v1/reports/investigation/{inv_id}/pdf")
    assert pdf_rep_res.status_code == 200
    assert "application/pdf" in pdf_rep_res.headers["content-type"]
    assert pdf_rep_res.content.startswith(b"%PDF-")  # Valid PDF binary signature

    # ── 8. Audit Trail Verification ───────────────────────────────────────────
    audit_res = await client.get(f"/api/v1/investigations/{inv_id}/audit")
    assert audit_res.status_code == 200
    audit_events = audit_res.json()["data"]
    actions = {e["action"] for e in audit_events}
    assert "investigation_created" in actions
    assert "alerts_grouped" in actions
    assert any("report_exported" in a for a in actions)

