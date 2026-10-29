"""
Shared Pydantic response schemas (error envelope, pagination, health).
"""

from __future__ import annotations

from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class ErrorDetail(BaseModel):
    code: str
    message: str
    field: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error envelope returned by all API endpoints on failure."""
    success: bool = False
    error: ErrorDetail


class SuccessResponse(BaseModel, Generic[DataT]):
    """Standard success envelope."""
    success: bool = True
    data: DataT


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Paginated list response."""
    success: bool = True
    data: List[DataT]
    total: int
    page: int
    page_size: int
    pages: int


class HealthResponse(BaseModel):
    status: str = Field(..., description="'ok' when the service is healthy")
    app_name: str
    version: str
    environment: str
    database: str = Field(..., description="'connected' or error message")

