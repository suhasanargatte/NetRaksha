"""
Investigation endpoints — CRUD, alert grouping, and audit trail.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alert import Alert
from app.models.audit import AuditRecord
from app.models.investigation import Investigation
from app.schemas.alert import AlertListResponse
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.investigation import (
    AuditRecordResponse,
    InvestigationAddAlerts,
    InvestigationCreate,
    InvestigationResponse,
    InvestigationUpdate,
)

router = APIRouter()


async def _get_or_404(investigation_id: int, db: AsyncSession) -> Investigation:
    result = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
    return inv


async def _build_response(inv: Investigation, db: AsyncSession) -> InvestigationResponse:
    count_result = await db.execute(
        select(func.count(Alert.id)).where(Alert.investigation_id == inv.id)
    )
    alert_count = count_result.scalar_one() or 0
    data = InvestigationResponse.model_validate(inv)
    data.alert_count = alert_count
    return data


@router.get("", response_model=PaginatedResponse[InvestigationResponse], summary="List investigations")
async def list_investigations(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[InvestigationResponse]:
    all_result = await db.execute(select(Investigation).order_by(Investigation.created_at.desc()))
    all_invs = all_result.scalars().all()
    total = len(all_invs)
    offset = (page - 1) * page_size
    paged = all_invs[offset : offset + page_size]

    data = [await _build_response(inv, db) for inv in paged]
    return PaginatedResponse(
        data=data, total=total, page=page, page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.post("", response_model=SuccessResponse[InvestigationResponse], status_code=status.HTTP_201_CREATED)
async def create_investigation(
    payload: InvestigationCreate,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[InvestigationResponse]:
    inv = Investigation(title=payload.title, notes=payload.notes)
    db.add(inv)
    await db.flush()

    audit = AuditRecord(
        investigation_id=inv.id,
        action="investigation_created",
        entity_type="investigation",
        entity_id=str(inv.id),
        detail=f"Investigation created: '{inv.title}'",
        actor="analyst",
    )
    db.add(audit)
    await db.commit()
    await db.refresh(inv)
    return SuccessResponse(data=await _build_response(inv, db))


@router.get("/{investigation_id}", response_model=SuccessResponse[InvestigationResponse])
async def get_investigation(
    investigation_id: int,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[InvestigationResponse]:
    inv = await _get_or_404(investigation_id, db)
    return SuccessResponse(data=await _build_response(inv, db))


@router.patch("/{investigation_id}", response_model=SuccessResponse[InvestigationResponse])
async def update_investigation(
    investigation_id: int,
    payload: InvestigationUpdate,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[InvestigationResponse]:
    inv = await _get_or_404(investigation_id, db)
    changes = []
    dump = payload.model_dump(exclude_unset=True)
    for field, value in dump.items():
        old_val = getattr(inv, field)
        if old_val != value:
            setattr(inv, field, value)
            changes.append(f"{field}: '{old_val}' -> '{value}'")

    if changes:
        audit = AuditRecord(
            investigation_id=inv.id,
            action="investigation_updated",
            entity_type="investigation",
            entity_id=str(inv.id),
            detail="; ".join(changes),
            actor="analyst",
        )
        db.add(audit)

    await db.commit()
    await db.refresh(inv)
    return SuccessResponse(data=await _build_response(inv, db))


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_investigation(
    investigation_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    inv = await _get_or_404(investigation_id, db)
    await db.delete(inv)
    await db.commit()


@router.get("/{investigation_id}/alerts", response_model=SuccessResponse[List[AlertListResponse]], summary="Get alerts for investigation")
async def get_investigation_alerts(
    investigation_id: int,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[List[AlertListResponse]]:
    """Return all alerts linked to this investigation."""
    await _get_or_404(investigation_id, db)
    result = await db.execute(
        select(Alert).where(Alert.investigation_id == investigation_id).order_by(Alert.created_at.desc())
    )
    alerts = result.scalars().all()
    return SuccessResponse(data=[AlertListResponse.model_validate(a) for a in alerts])


@router.post("/{investigation_id}/alerts", response_model=SuccessResponse[InvestigationResponse], summary="Add alerts to investigation group")
async def add_alerts_to_investigation(
    investigation_id: int,
    payload: InvestigationAddAlerts,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[InvestigationResponse]:
    """Group multiple alerts under an investigation."""
    inv = await _get_or_404(investigation_id, db)
    if payload.alert_ids:
        result = await db.execute(select(Alert).where(Alert.id.in_(payload.alert_ids)))
        alerts = result.scalars().all()
        for alert in alerts:
            alert.investigation_id = inv.id

        audit = AuditRecord(
            investigation_id=inv.id,
            action="alerts_grouped",
            entity_type="investigation",
            entity_id=str(inv.id),
            detail=f"Linked {len(alerts)} alert(s) [IDs: {', '.join(str(a.id) for a in alerts)}] to investigation",
            actor="analyst",
        )
        db.add(audit)
        await db.commit()
        await db.refresh(inv)

    return SuccessResponse(data=await _build_response(inv, db))


@router.delete("/{investigation_id}/alerts/{alert_id}", response_model=SuccessResponse[InvestigationResponse], summary="Remove alert from investigation")
async def remove_alert_from_investigation(
    investigation_id: int,
    alert_id: int,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[InvestigationResponse]:
    """Unlink an alert from an investigation."""
    inv = await _get_or_404(investigation_id, db)
    result = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.investigation_id == investigation_id))
    alert = result.scalar_one_or_none()
    if alert is not None:
        alert.investigation_id = None
        audit = AuditRecord(
            investigation_id=inv.id,
            action="alert_unlinked",
            entity_type="investigation",
            entity_id=str(inv.id),
            detail=f"Removed Alert #{alert_id} from investigation",
            actor="analyst",
        )
        db.add(audit)
        await db.commit()
        await db.refresh(inv)

    return SuccessResponse(data=await _build_response(inv, db))


@router.get("/{investigation_id}/audit", response_model=SuccessResponse[List[AuditRecordResponse]], summary="Get audit trail for investigation")
async def get_investigation_audit(
    investigation_id: int,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[List[AuditRecordResponse]]:
    """Return immutable audit trail for an investigation."""
    await _get_or_404(investigation_id, db)
    result = await db.execute(
        select(AuditRecord).where(AuditRecord.investigation_id == investigation_id).order_by(AuditRecord.timestamp.desc())
    )
    records = result.scalars().all()
    return SuccessResponse(data=[AuditRecordResponse.model_validate(r) for r in records])


