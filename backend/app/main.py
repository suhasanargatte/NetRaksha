"""
FastAPI application entry point for NetRakshak.

Startup sequence:
1. Load settings from environment / .env
2. Configure CORS (restricted to configured origins)
3. Register API router
4. Create database tables on first run
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as api_v1_router
from app.config import get_settings
from app.database import create_all_tables

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    """Startup and shutdown logic using the modern FastAPI lifespan API."""
    log.info("Starting %s v%s [%s]", settings.app_name, settings.app_version, settings.app_env)
    await create_all_tables()
    log.info("Database tables verified / created.")
    settings.upload_path()
    settings.reports_path()
    log.info("Storage directories ready.")

    yield  # application runs here

    log.info("%s shutting down.", settings.app_name)


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "NetRakshak — Offline Cybersecurity Analysis and Investigation Platform. "
        "All analysis is performed locally; no external API calls are made."
    ),
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development() else None,
    redoc_url="/redoc" if settings.is_development() else None,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Only allow listed origins. In development this is the Vite dev server.
# In production set CORS_ORIGINS to the exact production URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Check server logs for details.",
            },
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_v1_router)


# ── Root redirect ──────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    return JSONResponse(
        content={
            "app": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/v1/health",
        }
    )
