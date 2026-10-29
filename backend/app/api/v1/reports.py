"""
Report generation and download endpoints — CSV and PDF formats.
Operates completely offline using internal database records.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alert import Alert, AlertStatus, Severity
from app.models.audit import AuditRecord
from app.models.investigation import Investigation
from app.services.reports import (
    generate_alerts_csv,
    generate_investigation_csv,
    generate_investigation_pdf,
)

router = APIRouter()


@router.get("/investigation/{investigation_id}/csv", summary="Download investigation CSV report")
async def download_investigation_csv(
    investigation_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Generate and download a structured CSV report for an investigation."""
    inv_res = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    inv = inv_res.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")

    alerts_res = await db.execute(
        select(Alert).where(Alert.investigation_id == investigation_id).order_by(Alert.created_at.desc())
    )
    alerts = alerts_res.scalars().all()

    audit_res = await db.execute(
        select(AuditRecord).where(AuditRecord.investigation_id == investigation_id).order_by(AuditRecord.timestamp.asc())
    )
    audit_records = audit_res.scalars().all()

    csv_content = generate_investigation_csv(inv, alerts, audit_records)

    # Log audit event
    audit_log = AuditRecord(
        investigation_id=inv.id,
        action="report_exported_csv",
        entity_type="investigation",
        entity_id=str(inv.id),
        detail=f"Exported CSV report for Case #{inv.id} with {len(alerts)} alerts",
        actor="analyst",
    )
    db.add(audit_log)
    await db.commit()

    filename = f"NetRakshak-Investigation-{inv.id}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/investigation/{investigation_id}/pdf", summary="Download investigation PDF report")
async def download_investigation_pdf(
    investigation_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Generate and download a professional PDF investigation report."""
    inv_res = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    inv = inv_res.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")

    alerts_res = await db.execute(
        select(Alert).where(Alert.investigation_id == investigation_id).order_by(Alert.created_at.desc())
    )
    alerts = alerts_res.scalars().all()

    audit_res = await db.execute(
        select(AuditRecord).where(AuditRecord.investigation_id == investigation_id).order_by(AuditRecord.timestamp.asc())
    )
    audit_records = audit_res.scalars().all()

    pdf_bytes = generate_investigation_pdf(inv, alerts, audit_records)

    audit_log = AuditRecord(
        investigation_id=inv.id,
        action="report_exported_pdf",
        entity_type="investigation",
        entity_id=str(inv.id),
        detail=f"Exported PDF dossier for Case #{inv.id} with {len(alerts)} alerts",
        actor="analyst",
    )
    db.add(audit_log)
    await db.commit()

    filename = f"NetRakshak-Investigation-{inv.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/alerts/csv", summary="Download security alerts as CSV")
async def download_alerts_csv(
    severity: Optional[Severity] = Query(None),
    status_filter: Optional[AlertStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export filtered alerts as a downloadable CSV dataset."""
    q = select(Alert).order_by(Alert.created_at.desc())
    if severity:
        q = q.where(Alert.severity == severity)
    if status_filter:
        q = q.where(Alert.status == status_filter)

    res = await db.execute(q)
    alerts = res.scalars().all()

    csv_content = generate_alerts_csv(alerts)

    audit_log = AuditRecord(
        action="alerts_exported_csv",
        entity_type="alerts",
        entity_id="all",
        detail=f"Exported {len(alerts)} security alerts to CSV",
        actor="analyst",
    )
    db.add(audit_log)
    await db.commit()

    filename = "NetRakshak-Security-Alerts.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )

