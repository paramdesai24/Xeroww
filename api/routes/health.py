"""routes/health.py — GET /health endpoint."""

from fastapi import APIRouter

from api.core.config import settings

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
        "version": settings.APP_VERSION,
        "data_provider": settings.MARKET_DATA_PROVIDER,
        "data_note": "Near real-time data — Yahoo Finance delayed feed",
    }
