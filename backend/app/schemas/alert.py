"""
Pydantic schemas for Alert responses.
Compatible with Python 3.9.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, model_validator

from app.models.alert import AlertStatus, Severity


class EvidenceItem(BaseModel):
    event_id: Optional[int] = None
    line_number: int
    raw_line: str
    reason: str


class AlertReviewUpdate(BaseModel):
    status: Optional[AlertStatus] = None
    analyst_notes: Optional[str] = None
    investigation_id: Optional[int] = None


class AlertResponse(BaseModel):
    id: int
    log_file_id: int
    investigation_id: Optional[int] = None
    rule_id: str
    rule_name: str
    severity: Severity
    status: AlertStatus = AlertStatus.NEW
    description: str
    affected_entity: Optional[str] = None
    timestamp: Optional[datetime] = None
    analyst_notes: Optional[str] = None
    evidence: List[EvidenceItem] = []
    supporting_event_ids: List[int] = []
    ml_score: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def process_evidence(cls, data: Any) -> Any:
        """Parse evidence_json and populate evidence and supporting_event_ids."""
        if hasattr(data, "__dict__"):
            # SQLAlchemy ORM object
            ev_raw = getattr(data, "evidence_json", None)
            parsed_ev: List[Dict[str, Any]] = []
            if isinstance(ev_raw, str):
                try:
                    loaded = json.loads(ev_raw)
                    if isinstance(loaded, list):
                        parsed_ev = loaded
                except (json.JSONDecodeError, TypeError):
                    parsed_ev = []

            event_ids = [
                item["event_id"] for item in parsed_ev if isinstance(item, dict) and item.get("event_id") is not None
            ]

            return {
                "id": data.id,
                "log_file_id": data.log_file_id,
                "investigation_id": data.investigation_id,
                "rule_id": data.rule_id,
                "rule_name": data.rule_name,
                "severity": data.severity,
                "status": getattr(data, "status", AlertStatus.NEW),
                "description": data.description,
                "affected_entity": data.affected_entity,
                "timestamp": data.timestamp,
                "analyst_notes": getattr(data, "analyst_notes", None),
                "evidence": parsed_ev,
                "supporting_event_ids": event_ids,
                "ml_score": data.ml_score,
                "created_at": data.created_at,
            }
        return data


class AlertListResponse(BaseModel):
    id: int
    log_file_id: int
    investigation_id: Optional[int] = None
    rule_id: str
    rule_name: str
    severity: Severity
    status: AlertStatus = AlertStatus.NEW
    description: str
    affected_entity: Optional[str] = None
    timestamp: Optional[datetime] = None
    analyst_notes: Optional[str] = None
    supporting_event_count: int = 0
    ml_score: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def process_count(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            ev_raw = getattr(data, "evidence_json", None)
            count = 0
            if isinstance(ev_raw, str):
                try:
                    loaded = json.loads(ev_raw)
                    if isinstance(loaded, list):
                        count = len(loaded)
                except (json.JSONDecodeError, TypeError):
                    count = 0

            return {
                "id": data.id,
                "log_file_id": data.log_file_id,
                "investigation_id": data.investigation_id,
                "rule_id": data.rule_id,
                "rule_name": data.rule_name,
                "severity": data.severity,
                "status": getattr(data, "status", AlertStatus.NEW),
                "description": data.description,
                "affected_entity": data.affected_entity,
                "timestamp": data.timestamp,
                "analyst_notes": getattr(data, "analyst_notes", None),
                "supporting_event_count": count,
                "ml_score": data.ml_score,
                "created_at": data.created_at,
            }
        return data
