"""
FileIntegrityRecord ORM model — tracks reference SHA-256 hashes and verification checks.
Compatible with Python 3.9.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class IntegrityStatus(str, enum.Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    UNVERIFIED = "unverified"


class FileIntegrityRecord(Base):
    __tablename__ = "file_integrity_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    reference_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    calculated_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[IntegrityStatus] = mapped_column(
        Enum(IntegrityStatus), nullable=False, default=IntegrityStatus.UNVERIFIED
    )
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

