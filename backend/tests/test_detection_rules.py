"""
Synthetic test cases for the Rule-Based Security Detection Engine.
Verifies brute force, failed-then-success, event burst, after-hours, and privilege escalation rules.
"""

from __future__ import annotations

import io
import pytest
from httpx import AsyncClient


# 1. Repeated failed logins from 192.168.4.77 (4 attempts >= threshold of 3)
BRUTE_FORCE_CSV = (
    "timestamp,source_ip,user,action,service,message\n"
    "2026-10-28 14:00:01,192.168.4.77,admin,login_failed,sshd,Failed password for invalid user admin\n"
    "2026-10-28 14:00:02,192.168.4.77,admin,login_failed,sshd,Failed password for invalid user admin\n"
    "2026-10-28 14:00:03,192.168.4.77,admin,login_failed,sshd,Failed password for invalid user admin\n"
    "2026-10-28 14:00:04,192.168.4.77,admin,login_failed,sshd,Failed password for invalid user admin\n"
)

# 2. Failed logins followed by success for user 'alice'
FAILED_THEN_SUCCESS_CSV = (
    "timestamp,source_ip,user,action,service,message\n"
    "2026-10-28 15:00:01,10.0.1.5,alice,login_failed,sshd,Failed password for alice\n"
    "2026-10-28 15:00:02,10.0.1.5,alice,login_failed,sshd,Failed password for alice\n"
    "2026-10-28 15:00:05,10.0.1.5,alice,login_success,sshd,Accepted password for alice\n"
)

# 3. Privilege escalation
PRIVILEGE_CSV = (
    "timestamp,source_ip,user,action,service,message\n"
    "2026-10-28 16:00:00,192.168.1.50,deploy,sudo_exec,sudo,COMMAND=/bin/bash\n"
)

# 4. After-hours activity (02:30 AM is outside 07:00-20:00)
AFTER_HOURS_CSV = (
    "timestamp,source_ip,user,action,service,message\n"
    "2026-10-28 02:30:00,172.16.0.22,operator,login_success,sshd,Accepted publickey for operator\n"
)

# 5. Normal benign traffic (should trigger NO alerts)
BENIGN_CSV = (
    "timestamp,source_ip,user,action,service,message\n"
    "2026-10-28 10:00:00,192.168.1.10,bob,login_success,sshd,Accepted publickey for bob\n"
    "2026-10-28 10:05:00,192.168.1.10,bob,file_read,sftp,Read report.pdf\n"
)


@pytest.mark.asyncio
async def test_detect_brute_force(client: AsyncClient) -> None:
    """Repeated failed logins trigger R01 Brute Force alert with evidence."""
    files = {"file": ("brute_force.csv", io.BytesIO(BRUTE_FORCE_CSV.encode()), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201

    alerts_res = await client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["data"]

    bf_alert = next((a for a in alerts if a["rule_id"] == "R01"), None)
    assert bf_alert is not None
    assert "192.168.4.77" in bf_alert["affected_entity"]
    assert bf_alert["severity"] == "high"
    assert bf_alert["supporting_event_count"] >= 3

    # Check alert details endpoint
    detail_res = await client.get(f"/api/v1/alerts/{bf_alert['id']}")
    assert detail_res.status_code == 200
    detail = detail_res.json()["data"]
    assert len(detail["evidence"]) >= 3
    assert len(detail["supporting_event_ids"]) >= 3


@pytest.mark.asyncio
async def test_detect_failed_then_success(client: AsyncClient) -> None:
    """Failed logins followed by successful login trigger R02 alert."""
    files = {"file": ("compromise.csv", io.BytesIO(FAILED_THEN_SUCCESS_CSV.encode()), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201

    alerts_res = await client.get("/api/v1/alerts")
    alerts = alerts_res.json()["data"]

    comp_alert = next((a for a in alerts if a["rule_id"] == "R02"), None)
    assert comp_alert is not None
    assert "alice" in comp_alert["affected_entity"]
    assert comp_alert["severity"] == "critical"
    assert "successfully logged in after" in comp_alert["description"].lower()


@pytest.mark.asyncio
async def test_detect_privilege_escalation(client: AsyncClient) -> None:
    """Sudo/privilege commands trigger R05 alert."""
    files = {"file": ("priv.csv", io.BytesIO(PRIVILEGE_CSV.encode()), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201

    alerts_res = await client.get("/api/v1/alerts")
    alerts = alerts_res.json()["data"]

    priv_alert = next((a for a in alerts if a["rule_id"] == "R05"), None)
    assert priv_alert is not None
    assert "deploy" in priv_alert["affected_entity"]
    assert priv_alert["severity"] == "high"


@pytest.mark.asyncio
async def test_detect_after_hours(client: AsyncClient) -> None:
    """Activity at 02:30 AM triggers R04 After-Hours alert."""
    files = {"file": ("night.csv", io.BytesIO(AFTER_HOURS_CSV.encode()), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201

    alerts_res = await client.get("/api/v1/alerts")
    alerts = alerts_res.json()["data"]

    ah_alert = next((a for a in alerts if a["rule_id"] == "R04"), None)
    assert ah_alert is not None
    assert "operator" in ah_alert["affected_entity"]


@pytest.mark.asyncio
async def test_no_false_positives_on_benign_traffic(client: AsyncClient) -> None:
    """Normal traffic within business hours without failures does not trigger alerts."""
    files = {"file": ("benign.csv", io.BytesIO(BENIGN_CSV.encode()), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201
    assert upload_res.json()["data"]["alerts_generated"] == 0


@pytest.mark.asyncio
async def test_unusual_event_burst(client: AsyncClient, monkeypatch) -> None:
    """Event volume burst exceeding threshold generates R03 alert."""
    from app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "rule_burst_threshold", 5)
    monkeypatch.setattr(settings, "rule_burst_window_seconds", 30)

    # 6 events in 10 seconds from 203.0.113.99
    burst_csv = "timestamp,source_ip,action,message\n" + "\n".join(
        f"2026-10-28 12:00:0{i},203.0.113.99,query,lookup_{i}" for i in range(6)
    )

    files = {"file": ("burst.csv", io.BytesIO(burst_csv.encode()), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201

    alerts_res = await client.get("/api/v1/alerts")
    alerts = alerts_res.json()["data"]

    burst_alert = next((a for a in alerts if a["rule_id"] == "R03"), None)
    assert burst_alert is not None
    assert "203.0.113.99" in burst_alert["affected_entity"]
    assert burst_alert["supporting_event_count"] >= 5

