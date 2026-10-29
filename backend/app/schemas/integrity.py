"""
Pydantic schemas for File Integrity checks and records.
Compatible with Python 3.9.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class IntegrityVerifyResponse(BaseModel):
    filename: str
    reference_hash: str
    calculated_hash: str
    matched: bool
    file_size_bytes: int
    verified_at: datetime
    explanation: str = (
        "Matching hashes prove equality to the reference, not the original file's authenticity."
    )


class IntegrityRecordCreate(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
    reference_sha256: str = Field(..., min_length=64, max_length=64)
    notes: Optional[str] = None


class IntegrityRecordResponse(BaseModel):
    id: int
    filename: str
    reference_sha256: str
    calculated_sha256: Optional[str] = None
    status: str
    file_size_bytes: Optional[int] = None
    last_verified_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

