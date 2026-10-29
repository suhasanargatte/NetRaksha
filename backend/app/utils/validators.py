"""
Input validation utilities shared across the application.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path


ALLOWED_EXTENSIONS = {".log", ".txt", ".csv", ".gz"}
MAX_FILENAME_LEN = 255


def validate_upload_filename(filename: str) -> str:
    """
    Validate and sanitise an uploaded filename.

    Returns the sanitised filename.
    Raises ValueError with a user-friendly message on failure.
    """
    if not filename or not filename.strip():
        raise ValueError("Filename must not be empty.")

    # Strip path traversal attempts
    safe_name = Path(filename).name
    if not safe_name:
        raise ValueError("Invalid filename.")

    if len(safe_name) > MAX_FILENAME_LEN:
        raise ValueError(f"Filename exceeds {MAX_FILENAME_LEN} character limit.")

    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    return safe_name


def compute_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """
    Compute the SHA-256 hash of a file.

    Parameters
    ----------
    file_path : Path
        Path to the file on disk.
    chunk_size : int
        Read buffer size in bytes.

    Returns
    -------
    str
        Hex-encoded SHA-256 digest (64 characters).
    """
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


def verify_sha256(file_path: Path, expected_hash: str) -> bool:
    """Return True if the file's SHA-256 matches the expected hash."""
    return compute_sha256(file_path) == expected_hash.lower()

