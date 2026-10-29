"""
Security utilities — password hashing, verification, and token handling.
Uses standard library hashlib.pbkdf2_hmac (SHA-256, 600,000 iterations)
and hmac.compare_digest for constant-time comparisons.
Never stores plaintext passwords or hardcodes secrets.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from typing import Optional

ITERATIONS = 600_000
SALT_SIZE = 16


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a cryptographically secure random salt."""
    salt = os.urandom(SALT_SIZE)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        ITERATIONS,
    )
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a stored PBKDF2-HMAC-SHA256 hash using constant-time comparison."""
    try:
        algorithm, iterations_str, salt_hex, hash_hex = hashed_password.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
        computed_hash = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(computed_hash, expected_hash)
    except Exception:
        return False


def generate_secure_token() -> str:
    """Generate a high-entropy URL-safe session or API token."""
    return secrets.token_urlsafe(32)

