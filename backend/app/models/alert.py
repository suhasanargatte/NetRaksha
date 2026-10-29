"""
Alert ORM model — a detected security event (rule-based or ML-based).
Compatible with Python 3.9.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Severity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, enum.Enum):
    NEW = "New"
    UNDER_REVIEW = "Under Review"
    BENIGN = "Benign"
    CONFIRMED_INCIDENT = "Confirmed Incident"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    log_file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("log_files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    investigation_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("investigations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    rule_name: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    rule_id: Mapped[str] = mapped_column(String(16), nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False)
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus), nullable=False, default=AlertStatus.NEW, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    affected_entity: Mapped[Optional[str]] = mapped_column(String(256), nullable=True, index=True)
    timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    analyst_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # JSON string: list of evidence objects [{event_id, line_number, raw_line, reason}]
    evidence_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # ML anomaly score 0–1 (null = not ML-scored)
    ml_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    log_file: Mapped["LogFile"] = relationship("LogFile", back_populates="alerts")  # noqa: F821
    investigation: Mapped[Optional["Investigation"]] = relationship(  # noqa: F821
        "Investigation", back_populates="alerts"
    )
