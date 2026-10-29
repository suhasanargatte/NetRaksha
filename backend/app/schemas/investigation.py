"""
Pydantic schemas for Investigation CRUD.
Compatible with Python 3.9.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.investigation import InvestigationStatus


class AuditRecordResponse(BaseModel):
    id: int
    investigation_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: str
    detail: Optional[str] = None
    actor: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class InvestigationAddAlerts(BaseModel):
    alert_ids: List[int]


class InvestigationCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=512)
    notes: Optional[str] = None


class InvestigationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=512)
    status: Optional[InvestigationStatus] = None
    notes: Optional[str] = None


class InvestigationResponse(BaseModel):
    id: int
    title: str
    status: InvestigationStatus
    notes: Optional[str] = None
    alert_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
