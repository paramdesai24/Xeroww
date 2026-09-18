"""
routes/events.py
────────────────
REST API endpoints for Market Event Timeline and Explainability Engine.

Endpoints:
- GET /api/events/timeline/{symbol} — Full deterministic event timeline across historical period
- GET /api/events/at/{symbol}?step=N — Events triggered strictly at step index N

Routes delegate event detection and explainability directly to AnalyticsOrchestrator.
"""

import time
from typing import Dict, Tuple, List
from fastapi import APIRouter, Query, Depends
from api.core.dependencies import get_market_data_service
from api.services.market_data_service import MarketDataService
from api.analytics import default_orchestrator, AnalyticsOrchestrator
from api.schemas.events import MarketEventsTimelineResponse, MarketEvent

router = APIRouter(prefix="/events", tags=["Market Event Timeline"])

# In-memory cache: (normalized_symbol, period) -> (timestamp, List[MarketEvent])
_TIMELINE_CACHE: Dict[Tuple[str, str], Tuple[float, List[MarketEvent]]] = {}
_CACHE_TTL_SECONDS = 300.0  # 5 minutes cache for market events timeline


def _get_orchestrator() -> AnalyticsOrchestrator:
    return default_orchestrator


@router.get(
    "/timeline/{symbol}",
    response_model=MarketEventsTimelineResponse,
    summary="Get complete historical market event timeline",
)
def get_events_timeline(
    symbol: str,
    period: str = Query("3mo", description="Historical period: 1mo, 3mo, 6mo, 1y"),
    market_data: MarketDataService = Depends(get_market_data_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_symbol, candles = market_data.get_candles(symbol, period=period, interval="1d")
    cache_key = (norm_symbol, period)
    now = time.time()

    if cache_key in _TIMELINE_CACHE:
        cached_time, cached_events = _TIMELINE_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return {
                "symbol": norm_symbol,
                "total_events": len(cached_events),
                "events": cached_events,
            }

    events = orchestrator.run_events_timeline(norm_symbol, candles)

    # Cache results
    _TIMELINE_CACHE[cache_key] = (now, events)

    return {
        "symbol": norm_symbol,
        "total_events": len(events),
        "events": events,
    }


@router.get(
    "/at/{symbol}",
    response_model=List[MarketEvent],
    summary="Get market events triggered strictly at step index",
)
def get_events_at_step(
    symbol: str,
    step: int = Query(..., ge=0, description="Step index (0 to total_bars-1)"),
    period: str = Query("3mo", description="Historical period"),
    market_data: MarketDataService = Depends(get_market_data_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_symbol, candles = market_data.get_candles(symbol, period=period, interval="1d")
    return orchestrator.run_events_at_step(norm_symbol, candles, step)
