"""
File Integrity verification endpoints.
Cryptographically computes SHA-256 on raw file bytes and compares against reference hashes.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.audit import AuditRecord
from app.models.integrity import FileIntegrityRecord, IntegrityStatus
from app.models.log_file import LogFile
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.integrity import (
    IntegrityRecordCreate,
    IntegrityRecordResponse,
    IntegrityVerifyResponse,
)

router = APIRouter()
settings = get_settings()

INTEGRITY_EXPLANATION = (
    "Matching hashes prove equality to the reference, not the original file's authenticity."
)


@router.post("/verify-file", response_model=SuccessResponse[IntegrityVerifyResponse], summary="Verify uploaded file against reference hash")
async def verify_uploaded_file(
    file: UploadFile = File(...),
    reference_hash: str = Form(...),
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[IntegrityVerifyResponse]:
    """Calculate SHA-256 directly from raw file bytes and compare with the supplied reference hash."""
    clean_ref = reference_hash.strip().lower()
    if len(clean_ref) != 64 or not all(c in "0123456789abcdef" for c in clean_ref):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reference hash must be a valid 64-character hexadecimal SHA-256 string.",
        )

    content = await file.read()
    calculated_hash = hashlib.sha256(content).hexdigest().lower()
    matched = (calculated_hash == clean_ref)

    # Immutable audit logging
    audit = AuditRecord(
        action="integrity_verified_upload",
        entity_type="file",
        entity_id=file.filename or "unknown",
        detail=f"SHA-256 {'MATCH' if matched else 'MISMATCH'}: calculated {calculated_hash} vs ref {clean_ref}",
        actor="analyst",
    )
    db.add(audit)
    await db.commit()

    return SuccessResponse(
        data=IntegrityVerifyResponse(
            filename=file.filename or "uploaded_file",
            reference_hash=clean_ref,
            calculated_hash=calculated_hash,
            matched=matched,
            file_size_bytes=len(content),
            verified_at=datetime.now(timezone.utc),
            explanation=INTEGRITY_EXPLANATION,
        )
    )


@router.post("/verify-log/{log_file_id}", response_model=SuccessResponse[IntegrityVerifyResponse], summary="Verify stored log archive integrity")
async def verify_log_file_integrity(
    log_file_id: int,
    reference_hash: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[IntegrityVerifyResponse]:
    """Verify stored log archive by re-reading raw bytes from disk and comparing with ingestion or reference hash."""
    result = await db.execute(select(LogFile).where(LogFile.id == log_file_id))
    log_file = result.scalar_one_or_none()
    if log_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log file archive not found")

    file_path = settings.upload_path() / log_file.filename
    if not file_path.exists():
        # Fall back to database-recorded hash if disk file was purged
        calculated_hash = log_file.sha256.lower()
        file_size = log_file.size_bytes
    else:
        disk_bytes = file_path.read_bytes()
        calculated_hash = hashlib.sha256(disk_bytes).hexdigest().lower()
        file_size = len(disk_bytes)

    target_ref = reference_hash.strip().lower() if reference_hash else log_file.sha256.lower()
    matched = (calculated_hash == target_ref)

    audit = AuditRecord(
        action="integrity_verified_log",
        entity_type="log_file",
        entity_id=str(log_file.id),
        detail=f"Log archive #{log_file.id} ({log_file.original_filename}) verification {'MATCH' if matched else 'MISMATCH'}: {calculated_hash}",
        actor="analyst",
    )
    db.add(audit)
    await db.commit()

    return SuccessResponse(
        data=IntegrityVerifyResponse(
            filename=log_file.original_filename,
            reference_hash=target_ref,
            calculated_hash=calculated_hash,
            matched=matched,
            file_size_bytes=file_size,
            verified_at=datetime.now(timezone.utc),
            explanation=INTEGRITY_EXPLANATION,
        )
    )


@router.get("/records", response_model=PaginatedResponse[IntegrityRecordResponse], summary="List integrity baseline records")
async def list_integrity_records(
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[IntegrityRecordResponse]:
    q = select(FileIntegrityRecord).order_by(FileIntegrityRecord.created_at.desc())
    all_res = await db.execute(q)
    records = all_res.scalars().all()
    total = len(records)
    offset = (page - 1) * page_size
    paged = records[offset : offset + page_size]

    return PaginatedResponse(
        data=[IntegrityRecordResponse.model_validate(r) for r in paged],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.post("/records", response_model=SuccessResponse[IntegrityRecordResponse], status_code=status.HTTP_201_CREATED, summary="Create integrity baseline record")
async def create_integrity_record(
    payload: IntegrityRecordCreate,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[IntegrityRecordResponse]:
    clean_ref = payload.reference_sha256.strip().lower()
    if len(clean_ref) != 64 or not all(c in "0123456789abcdef" for c in clean_ref):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reference hash must be a 64-character hexadecimal SHA-256 string.",
        )

    rec = FileIntegrityRecord(
        filename=payload.filename.strip(),
        reference_sha256=clean_ref,
        notes=payload.notes,
        status=IntegrityStatus.UNVERIFIED,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return SuccessResponse(data=IntegrityRecordResponse.model_validate(rec))


@router.post("/records/{record_id}/verify", response_model=SuccessResponse[IntegrityVerifyResponse], summary="Verify file against stored baseline")
async def verify_against_record(
    record_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[IntegrityVerifyResponse]:
    result = await db.execute(select(FileIntegrityRecord).where(FileIntegrityRecord.id == record_id))
    rec = result.scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integrity baseline record not found")

    content = await file.read()
    calc_hash = hashlib.sha256(content).hexdigest().lower()
    matched = (calc_hash == rec.reference_sha256.lower())

    rec.calculated_sha256 = calc_hash
    rec.status = IntegrityStatus.MATCH if matched else IntegrityStatus.MISMATCH
    rec.file_size_bytes = len(content)
    rec.last_verified_at = datetime.now(timezone.utc)

    audit = AuditRecord(
        action="integrity_verified_baseline",
        entity_type="integrity_record",
        entity_id=str(rec.id),
        detail=f"Baseline verification for '{rec.filename}' {'MATCH' if matched else 'MISMATCH'}: {calc_hash}",
        actor="analyst",
    )
    db.add(audit)
    await db.commit()

    return SuccessResponse(
        data=IntegrityVerifyResponse(
            filename=file.filename or rec.filename,
            reference_hash=rec.reference_sha256,
            calculated_hash=calc_hash,
            matched=matched,
            file_size_bytes=len(content),
            verified_at=rec.last_verified_at,
            explanation=INTEGRITY_EXPLANATION,
        )
    )
