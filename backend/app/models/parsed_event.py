"""
ParsedEvent ORM model — one normalised log event row.
Compatible with Python 3.9.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class ParsedEvent(Base):
    __tablename__ = "parsed_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    log_file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("log_files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    source_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    dest_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    service: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    http_method: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    http_path: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_line: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    log_file: Mapped["LogFile"] = relationship("LogFile", back_populates="events")  # noqa: F821
