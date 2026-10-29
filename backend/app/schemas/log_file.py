"""
Pydantic schemas for LogFile and ParsedEvent responses.
Compatible with Python 3.9.
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.log_file import LogFormat, LogStatus


class LogFileResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    sha256: str
    size_bytes: int
    format: LogFormat
    line_count: int
    status: LogStatus
    error_detail: Optional[str] = None
    uploaded_at: datetime
    parsed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LogFileListResponse(BaseModel):
    id: int
    original_filename: str
    sha256: str
    size_bytes: int
    format: LogFormat
    status: LogStatus
    line_count: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ValidationSummary(BaseModel):
    total_rows: int
    valid_rows: int
    malformed_rows: int
    duplicate_rows: int
    missing_timestamp_rows: int
    detected_columns: List[str]
    column_mapping: Dict[str, str]


class LogUploadResponse(BaseModel):
    log_file: LogFileResponse
    validation: ValidationSummary
    alerts_generated: int = 0


class ParsedEventResponse(BaseModel):
    id: int
    log_file_id: int
    line_number: int
    timestamp: Optional[datetime] = None
    source_ip: Optional[str] = None
    dest_ip: Optional[str] = None
    user: Optional[str] = None
    action: Optional[str] = None
    service: Optional[str] = None
    http_method: Optional[str] = None
    http_path: Optional[str] = None
    http_status: Optional[int] = None
    response_bytes: Optional[int] = None
    message: Optional[str] = None
    raw_line: str

    model_config = {"from_attributes": True}
