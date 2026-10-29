"""
LogFile ORM model — represents an uploaded log file.
Compatible with Python 3.9 (uses Optional[] instead of X | None).
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class LogFormat(str, enum.Enum):
    CSV = "csv"
    SYSLOG = "syslog"
    AUTH_LOG = "auth_log"
    APACHE_ACCESS = "apache_access"
    NGINX_ACCESS = "nginx_access"
    UNKNOWN = "unknown"


class LogStatus(str, enum.Enum):
    PENDING = "pending"
    PARSING = "parsing"
    READY = "ready"
    ERROR = "error"


class LogFile(Base):
    __tablename__ = "log_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[LogFormat] = mapped_column(
        Enum(LogFormat), nullable=False, default=LogFormat.UNKNOWN
    )
    line_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[LogStatus] = mapped_column(
        Enum(LogStatus), nullable=False, default=LogStatus.PENDING
    )
    error_detail: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    parsed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    events: Mapped[List["ParsedEvent"]] = relationship(  # noqa: F821
        "ParsedEvent", back_populates="log_file", cascade="all, delete-orphan"
    )
    alerts: Mapped[List["Alert"]] = relationship(  # noqa: F821
        "Alert", back_populates="log_file", cascade="all, delete-orphan"
    )
