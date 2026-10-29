"""
Audit event log endpoints — immutable audit trail for security investigations.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit import AuditRecord
from app.schemas.common import PaginatedResponse
from app.schemas.investigation import AuditRecordResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AuditRecordResponse], summary="List immutable audit trail events")
async def list_audit_records(
    page: int = 1,
    page_size: int = 50,
    entity_type: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AuditRecordResponse]:
    q = select(AuditRecord).order_by(AuditRecord.timestamp.desc())
    if entity_type:
        q = q.where(AuditRecord.entity_type == entity_type)
    if actor:
        q = q.where(AuditRecord.actor == actor)

    all_res = await db.execute(q)
    records = all_res.scalars().all()
    total = len(records)
    offset = (page - 1) * page_size
    paged = records[offset : offset + page_size]

    return PaginatedResponse(
        data=[AuditRecordResponse.model_validate(r) for r in paged],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )

