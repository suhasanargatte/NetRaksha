"""
Log file endpoints — upload, list, detail, events, and delete.
Provides offline CSV ingestion, validation, and parsed event retrieval.
"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.csv_parser import CSVLogParser
from app.database import get_db
from app.detection.engine import DetectionEngine
from app.detection.ml_engine import MLAnomalyDetector
from app.models.log_file import LogFile, LogFormat, LogStatus
from app.models.parsed_event import ParsedEvent
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.log_file import (
    LogFileListResponse,
    LogFileResponse,
    LogUploadResponse,
    ParsedEventResponse,
)
from app.utils.validators import validate_upload_filename

router = APIRouter()
settings = get_settings()


@router.post(
    "/upload",
    response_model=SuccessResponse[LogUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload and analyze a CSV log file",
)
async def upload_log_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[LogUploadResponse]:
    """
    Accepts a CSV log file, computes its SHA-256 checksum, validates columns and records,
    and stores the normalized events in the local database.
    """
    # 1. Validate filename and extension
    try:
        safe_filename = validate_upload_filename(file.filename or "")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    ext = Path(safe_filename).suffix.lower()
    if ext not in {".csv", ".log", ".txt"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. NetRakshak currently accepts .csv, .log, and .txt log files.",
        )

    # 2. Read content into memory and validate size
    content = await file.read()
    if not content or len(content.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB.",
        )

    # 3. Compute SHA-256 digest
    sha256_hash = hashlib.sha256(content).hexdigest()

    # 4. Parse & validate CSV rows
    parser = CSVLogParser(content, original_filename=safe_filename)
    try:
        events_data, validation_summary = parser.parse()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Log validation failed: {exc}",
        ) from exc

    # 5. Persist file on disk (forensic chain of custody)
    upload_dir = settings.upload_path()
    disk_filename = f"{sha256_hash[:16]}_{safe_filename}"
    file_path = upload_dir / disk_filename
    with open(file_path, "wb") as f:
        f.write(content)

    # 6. Create LogFile record
    log_file = LogFile(
        filename=disk_filename,
        original_filename=safe_filename,
        sha256=sha256_hash,
        size_bytes=len(content),
        format=LogFormat.CSV,
        line_count=validation_summary.valid_rows,
        status=LogStatus.READY,
        parsed_at=datetime.utcnow(),
    )
    db.add(log_file)
    await db.flush()  # populate log_file.id

    # 7. Batch insert parsed events
    parsed_entities = [
        ParsedEvent(
            log_file_id=log_file.id,
            line_number=ev["line_number"],
            timestamp=ev["timestamp"],
            source_ip=ev["source_ip"],
            dest_ip=ev["dest_ip"],
            user=ev["user"],
            action=ev["action"],
            service=ev["service"],
            http_method=ev["http_method"],
            http_path=ev["http_path"],
            http_status=ev["http_status"],
            response_bytes=ev["response_bytes"],
            message=ev["message"],
            raw_line=ev["raw_line"],
        )
        for ev in events_data
    ]

    db.add_all(parsed_entities)
    await db.flush()  # populate event IDs

    # 8. Run rule-based detection engine
    detector = DetectionEngine(log_file_id=log_file.id)
    generated_alerts = detector.run(parsed_entities)

    # 9. Run Scikit-learn ML anomaly detection engine
    try:
        ml_detector = MLAnomalyDetector(log_file_id=log_file.id)
        ml_alerts = ml_detector.run(parsed_entities)
    except Exception as exc:  # noqa: BLE001
        ml_alerts = []

    all_alerts = generated_alerts + ml_alerts
    if all_alerts:
        db.add_all(all_alerts)

    await db.commit()
    await db.refresh(log_file)

    response_data = LogUploadResponse(
        log_file=LogFileResponse.model_validate(log_file),
        validation=validation_summary,
        alerts_generated=len(all_alerts),
    )

    return SuccessResponse(data=response_data)


@router.get(
    "",
    response_model=PaginatedResponse[LogFileListResponse],
    summary="List uploaded log files",
)
async def list_log_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[LogFileListResponse]:
    """Return a paginated list of all uploaded log files."""
    count_result = await db.execute(select(func.count(LogFile.id)))
    total = count_result.scalar_one() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(LogFile).order_by(LogFile.uploaded_at.desc()).offset(offset).limit(page_size)
    )
    files = result.scalars().all()

    return PaginatedResponse(
        data=[LogFileListResponse.model_validate(f) for f in files],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.get(
    "/events/recent",
    response_model=PaginatedResponse[ParsedEventResponse],
    summary="Retrieve most recent parsed events across all log archives",
)
async def get_recent_log_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Filter by user, IP, or message"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[ParsedEventResponse]:
    """Retrieve chronologically recent parsed events across all ingested log files."""
    query = select(ParsedEvent)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                ParsedEvent.source_ip.ilike(search_pattern),
                ParsedEvent.dest_ip.ilike(search_pattern),
                ParsedEvent.user.ilike(search_pattern),
                ParsedEvent.action.ilike(search_pattern),
                ParsedEvent.message.ilike(search_pattern),
                ParsedEvent.raw_line.ilike(search_pattern),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total = count_res.scalar_one() or 0

    offset = (page - 1) * page_size
    events_res = await db.execute(
        query.order_by(ParsedEvent.id.desc()).offset(offset).limit(page_size)
    )
    events = events_res.scalars().all()

    return PaginatedResponse(
        data=[ParsedEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.get(
    "/{log_id}",
    response_model=SuccessResponse[LogFileResponse],
    summary="Get log file detail",
)
async def get_log_file(
    log_id: int,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[LogFileResponse]:
    """Return detailed information about a specific log file."""
    result = await db.execute(select(LogFile).where(LogFile.id == log_id))
    log_file = result.scalar_one_or_none()
    if log_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log file not found")

    return SuccessResponse(data=LogFileResponse.model_validate(log_file))


@router.get(
    "/{log_id}/events",
    response_model=PaginatedResponse[ParsedEventResponse],
    summary="Get paginated parsed events for a log file",
)
async def get_log_events(
    log_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Filter by user, IP, or message"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[ParsedEventResponse]:
    """Retrieve normalized events extracted from an analyzed log file."""
    # Ensure log file exists
    log_check = await db.execute(select(LogFile.id).where(LogFile.id == log_id))
    if not log_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log file not found")

    query = select(ParsedEvent).where(ParsedEvent.log_file_id == log_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                ParsedEvent.source_ip.ilike(search_pattern),
                ParsedEvent.dest_ip.ilike(search_pattern),
                ParsedEvent.user.ilike(search_pattern),
                ParsedEvent.action.ilike(search_pattern),
                ParsedEvent.message.ilike(search_pattern),
                ParsedEvent.raw_line.ilike(search_pattern),
            )
        )

    # Total matching records
    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total = count_res.scalar_one() or 0

    offset = (page - 1) * page_size
    events_res = await db.execute(
        query.order_by(ParsedEvent.line_number.asc()).offset(offset).limit(page_size)
    )
    events = events_res.scalars().all()

    return PaginatedResponse(
        data=[ParsedEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.delete(
    "/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete log file and associated events",
)
async def delete_log_file(
    log_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a log file from the database and remove the archived file from disk."""
    result = await db.execute(select(LogFile).where(LogFile.id == log_id))
    log_file = result.scalar_one_or_none()
    if log_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log file not found")

    # Remove file on disk if exists
    upload_path = settings.upload_path() / log_file.filename
    if upload_path.exists():
        try:
            os.remove(upload_path)
        except OSError:
            pass

    await db.delete(log_file)
    await db.commit()
