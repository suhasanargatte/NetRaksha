"""
Tests for CSV log upload, validation, and event analysis.
"""

from __future__ import annotations

import io
import pytest
from httpx import AsyncClient


VALID_CSV = (
    "timestamp,source_ip,dest_ip,user,action,service,http_status,message\n"
    "2026-10-28 14:10:01,192.168.1.105,10.0.0.1,admin,login_success,sshd,,Accepted key\n"
    "2026-10-28 14:12:15,192.168.4.77,10.0.0.1,root,login_failed,sshd,,Failed pass\n"
    "2026-10-28 14:15:30,10.0.2.88,10.0.0.5,-,GET,nginx,200,/index.html\n"
    "2026-10-28 14:15:30,10.0.2.88,10.0.0.5,-,GET,nginx,200,/index.html\n"  # Duplicate row
)

MALFORMED_CSV = (
    "timestamp,source_ip,user,action\n"
    "not-a-real-date,192.168.1.1,root,login\n"
    "2026-10-28 14:00:00,192.168.1.2,guest,logout\n"
)


@pytest.mark.asyncio
async def test_upload_valid_csv(client: AsyncClient) -> None:
    """Valid CSV file uploads cleanly, parses events, and returns validation summary."""
    files = {"file": ("auth_sample.csv", io.BytesIO(VALID_CSV.encode("utf-8")), "text/csv")}
    response = await client.post("/api/v1/logs/upload", files=files)
    assert response.status_code == 201

    body = response.json()
    assert body["success"] is True
    data = body["data"]

    log_file = data["log_file"]
    assert log_file["original_filename"] == "auth_sample.csv"
    assert log_file["format"] == "csv"
    assert log_file["line_count"] == 4
    assert len(log_file["sha256"]) == 64

    validation = data["validation"]
    assert validation["valid_rows"] == 4
    assert validation["duplicate_rows"] == 1
    assert "source_ip" in validation["detected_columns"]


@pytest.mark.asyncio
async def test_upload_empty_file(client: AsyncClient) -> None:
    """Empty 0-byte file must be rejected with HTTP 400."""
    files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    response = await client.post("/api/v1/logs/upload", files=files)
    assert response.status_code == 400
    assert "empty" in response.text.lower()


@pytest.mark.asyncio
async def test_upload_invalid_extension(client: AsyncClient) -> None:
    """Unsupported file extension (e.g. .exe) must be rejected with HTTP 400."""
    files = {"file": ("malware.exe", io.BytesIO(b"MZBINARY"), "application/octet-stream")}
    response = await client.post("/api/v1/logs/upload", files=files)
    assert response.status_code == 400
    assert "unsupported" in response.text.lower()


@pytest.mark.asyncio
async def test_upload_oversized_file(client: AsyncClient, monkeypatch) -> None:
    """File exceeding size threshold must be rejected with HTTP 413."""
    from app.config import get_settings

    settings = get_settings()
    # Temporarily set max size to 50 bytes for test
    monkeypatch.setattr(settings, "max_upload_size_mb", 0.00005)  # ~52 bytes

    big_content = "timestamp,source_ip,message\n" + ("2026-10-28 12:00:00,1.1.1.1,test\n" * 10)
    files = {"file": ("large.csv", io.BytesIO(big_content.encode("utf-8")), "text/csv")}

    response = await client.post("/api/v1/logs/upload", files=files)
    assert response.status_code == 413
    assert "exceeds" in response.text.lower()


@pytest.mark.asyncio
async def test_upload_malformed_timestamps_handled_safely(client: AsyncClient) -> None:
    """Invalid timestamps are counted in validation metrics while preserving original row."""
    files = {"file": ("malformed.csv", io.BytesIO(MALFORMED_CSV.encode("utf-8")), "text/csv")}
    response = await client.post("/api/v1/logs/upload", files=files)
    assert response.status_code == 201

    body = response.json()
    validation = body["data"]["validation"]
    assert validation["valid_rows"] == 2
    assert validation["missing_timestamp_rows"] == 1


@pytest.mark.asyncio
async def test_get_log_events_paginated(client: AsyncClient) -> None:
    """Parsed events can be fetched with pagination and search filter."""
    files = {"file": ("events_test.csv", io.BytesIO(VALID_CSV.encode("utf-8")), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    assert upload_res.status_code == 201
    log_id = upload_res.json()["data"]["log_file"]["id"]

    # 1. Fetch first page
    events_res = await client.get(f"/api/v1/logs/{log_id}/events?page=1&page_size=2")
    assert events_res.status_code == 200
    events_body = events_res.json()
    assert events_body["total"] == 4
    assert len(events_body["data"]) == 2

    # 2. Search by IP
    search_res = await client.get(f"/api/v1/logs/{log_id}/events?search=192.168.4.77")
    assert search_res.status_code == 200
    search_body = search_res.json()
    assert search_body["total"] == 1
    assert search_body["data"][0]["user"] == "root"


@pytest.mark.asyncio
async def test_delete_log_file(client: AsyncClient) -> None:
    """Deleting a log file returns 204 and removes it from subsequent lists."""
    files = {"file": ("to_delete.csv", io.BytesIO(VALID_CSV.encode("utf-8")), "text/csv")}
    upload_res = await client.post("/api/v1/logs/upload", files=files)
    log_id = upload_res.json()["data"]["log_file"]["id"]

    # Delete
    del_res = await client.delete(f"/api/v1/logs/{log_id}")
    assert del_res.status_code == 204

    # Subsequent GET returns 404
    get_res = await client.get(f"/api/v1/logs/{log_id}")
    assert get_res.status_code == 404

