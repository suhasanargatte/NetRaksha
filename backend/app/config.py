"""
Application configuration loaded from environment variables / .env file.
All sensitive values must be set in .env (never committed).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "NetRakshak"
    app_version: str = "0.1.0"
    app_env: str = "development"

    # ── Server ───────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./netrakshak.db"

    # ── File storage ─────────────────────────────────────────────────────────
    upload_dir: str = "./uploads"
    reports_dir: str = "./reports"
    max_upload_size_mb: int = 100

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    # ── ML ───────────────────────────────────────────────────────────────────
    ml_contamination: float = 0.05
    ml_anomaly_threshold: float = 0.7

    # ── Detection Rules Thresholds ───────────────────────────────────────────
    rule_brute_force_threshold: int = 3
    rule_brute_force_window_seconds: int = 300
    rule_burst_threshold: int = 20
    rule_burst_window_seconds: int = 60
    rule_after_hours_start: int = 7
    rule_after_hours_end: int = 20
    rule_failed_then_success_threshold: int = 2

    # ── Logging ──────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    @field_validator("app_env")
    @classmethod
    def validate_env(cls, v: str) -> str:
        allowed = {"development", "production", "test"}
        if v not in allowed:
            raise ValueError(f"app_env must be one of {allowed}")
        return v

    def is_development(self) -> bool:
        return self.app_env == "development"

    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    def reports_path(self) -> Path:
        p = Path(self.reports_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton pattern)."""
    return Settings()

