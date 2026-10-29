"""
Shared formatting helpers.
"""

from __future__ import annotations

from datetime import datetime


def human_size(size_bytes: int) -> str:
    """Return a human-readable file size string."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes //= 1024
    return f"{size_bytes:.1f} TB"


def format_iso(dt: datetime | None) -> str | None:
    """Return an ISO 8601 UTC string or None."""
    if dt is None:
        return None
    return dt.isoformat()

