"""
Tests for the health check endpoint.

GET /api/v1/health
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient) -> None:
    """Health endpoint must return HTTP 200."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_response_schema(client: AsyncClient) -> None:
    """Health response must include required fields with correct values."""
    response = await client.get("/api/v1/health")
    body = response.json()

    assert body["status"] == "ok"
    assert body["app_name"] == "NetRakshak"
    assert "version" in body
    assert "environment" in body
    assert body["database"] == "connected"


@pytest.mark.asyncio
async def test_health_content_type(client: AsyncClient) -> None:
    """Health endpoint must return JSON."""
    response = await client.get("/api/v1/health")
    assert "application/json" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_root_returns_app_info(client: AsyncClient) -> None:
    """Root / returns app metadata (not a 404)."""
    response = await client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert "app" in body
    assert body["health"] == "/api/v1/health"


@pytest.mark.asyncio
async def test_unknown_route_returns_404(client: AsyncClient) -> None:
    """Unknown routes must return 404 (not 500)."""
    response = await client.get("/api/v1/nonexistent-endpoint")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_logs_empty(client: AsyncClient) -> None:
    """Logs list returns empty paginated response when no files uploaded."""
    response = await client.get("/api/v1/logs")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_alerts_empty(client: AsyncClient) -> None:
    """Alerts list returns empty paginated response when no alerts exist."""
    response = await client.get("/api/v1/alerts")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_investigations_empty(client: AsyncClient) -> None:
    """Investigations list returns empty paginated response initially."""
    response = await client.get("/api/v1/investigations")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []


@pytest.mark.asyncio
async def test_create_investigation(client: AsyncClient) -> None:
    """Creating an investigation returns HTTP 201 with correct fields."""
    payload = {"title": "Test Investigation Alpha", "notes": "Initial notes."}
    response = await client.post("/api/v1/investigations", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["title"] == "Test Investigation Alpha"
    assert body["data"]["status"] == "open"
    assert body["data"]["alert_count"] == 0


@pytest.mark.asyncio
async def test_get_investigation_not_found(client: AsyncClient) -> None:
    """Requesting a non-existent investigation returns 404."""
    response = await client.get("/api/v1/investigations/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_investigation_invalid_title(client: AsyncClient) -> None:
    """Title shorter than 3 characters must be rejected with 422."""
    response = await client.post("/api/v1/investigations", json={"title": "AB"})
    assert response.status_code == 422

