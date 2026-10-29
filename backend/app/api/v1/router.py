"""
API v1 router — aggregates all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1 import health, logs, alerts, investigations, integrity, audit, reports, auth

router = APIRouter(prefix="/api/v1")

router.include_router(health.router, tags=["Health"])
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(logs.router, prefix="/logs", tags=["Logs"])
router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
router.include_router(investigations.router, prefix="/investigations", tags=["Investigations"])
router.include_router(integrity.router, prefix="/integrity", tags=["File Integrity"])
router.include_router(audit.router, prefix="/audit", tags=["Audit Trail"])
router.include_router(reports.router, prefix="/reports", tags=["Reports"])

