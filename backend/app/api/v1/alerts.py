"""
Alert endpoints — list, detail, and review updates.
Alert creation is performed by the detection engine.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alert import Alert, AlertStatus, Severity
from app.models.audit import AuditRecord
from app.schemas.alert import AlertListResponse, AlertResponse, AlertReviewUpdate
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AlertListResponse], summary="List alerts")
async def list_alerts(
    page: int = 1,
    page_size: int = 50,
    severity: Optional[Severity] = Query(None),
    status_filter: Optional[AlertStatus] = Query(None, alias="status"),
    log_file_id: Optional[int] = Query(None),
    investigation_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AlertListResponse]:
    """Return a paginated, filterable list of alerts."""
    q = select(Alert).order_by(Alert.created_at.desc())
    if severity:
        q = q.where(Alert.severity == severity)
    if status_filter:
        q = q.where(Alert.status == status_filter)
    if log_file_id:
        q = q.where(Alert.log_file_id == log_file_id)
    if investigation_id:
        q = q.where(Alert.investigation_id == investigation_id)

    all_result = await db.execute(q)
    all_alerts = all_result.scalars().all()
    total = len(all_alerts)

    offset = (page - 1) * page_size
    paged = all_alerts[offset : offset + page_size]

    return PaginatedResponse(
        data=[AlertListResponse.model_validate(a) for a in paged],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.get("/{alert_id}", response_model=SuccessResponse[AlertResponse], summary="Get alert detail")
async def get_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[AlertResponse]:
    """Return full alert detail including evidence from the original log."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    return SuccessResponse(data=AlertResponse.model_validate(alert))


@router.patch("/{alert_id}", response_model=SuccessResponse[AlertResponse], summary="Review alert status and notes")
async def update_alert_review(
    alert_id: int,
    payload: AlertReviewUpdate,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[AlertResponse]:
    """Allow an analyst to review an alert, update its status (New, Under Review, Benign, Confirmed Incident), notes, or linked investigation."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    changes = []
    if payload.status is not None and payload.status != alert.status:
        old_status = alert.status.value if hasattr(alert.status, "value") else str(alert.status)
        new_status = payload.status.value if hasattr(payload.status, "value") else str(payload.status)
        alert.status = payload.status
        changes.append(f"Status changed from '{old_status}' to '{new_status}'")

    if payload.analyst_notes is not None and payload.analyst_notes != alert.analyst_notes:
        alert.analyst_notes = payload.analyst_notes
        changes.append("Analyst notes updated")

    if payload.investigation_id is not None and payload.investigation_id != alert.investigation_id:
        alert.investigation_id = payload.investigation_id
        changes.append(f"Assigned to Investigation #{payload.investigation_id}")

    if changes:
        # Create immutable audit record
        audit = AuditRecord(
            investigation_id=alert.investigation_id,
            action="alert_review_updated",
            entity_type="alert",
            entity_id=str(alert.id),
            detail="; ".join(changes),
            actor="analyst",
        )
        db.add(audit)

    await db.commit()
    await db.refresh(alert)
    return SuccessResponse(data=AlertResponse.model_validate(alert))


