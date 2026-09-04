"""routes/health.py — GET /health endpoint."""

from fastapi import APIRouter
import os

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Health check")
async def health_check() -> dict:
    """
    Returns the operational status of the Xeroww API service.
    Useful for uptime monitoring, load balancer health probes, and dashboard status indicators.
    """
    return {
        "status": "healthy",
        "service": "xeroww-api",
        "version": os.getenv("APP_VERSION", "0.1.0"),
        "data_provider": os.getenv("MARKET_DATA_PROVIDER", "yahoo"),
        "data_note": "Near real-time data — Yahoo Finance delayed feed",
    }
