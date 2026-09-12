"""
routes/events.py
────────────────
REST API endpoints for Market Event Timeline and Explainability Engine.

Endpoints:
- GET /api/events/timeline/{symbol} — Full deterministic event timeline across historical period
- GET /api/events/at/{symbol}?step=N — Events triggered strictly at step index N
"""

import time
from typing import Dict, Tuple, List, Any
from fastapi import APIRouter, HTTPException, Query, status
from api.services.yahoo_provider import YahooFinanceProvider
from api.services.event_engine import EventEngine
from api.schemas.events import MarketEventsTimelineResponse, MarketEvent

router = APIRouter(prefix="/events", tags=["Market Event Timeline"])
_provider = YahooFinanceProvider()

# Simple in-memory cache: (normalized_symbol, period) -> (timestamp, List[MarketEvent])
_TIMELINE_CACHE: Dict[Tuple[str, str], Tuple[float, List[MarketEvent]]] = {}
_CACHE_TTL_SECONDS = 300.0  # 5 minutes cache for market events timeline


def _get_engine(symbol: str, period: str = "3mo") -> EventEngine:
    try:
        candles = _provider.get_ohlc(symbol, period=period, interval="1d")
        return EventEngine(symbol=_provider.normalize_symbol(symbol), all_candles=candles)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data error: {e}")


@router.get(
    "/timeline/{symbol}",
    response_model=MarketEventsTimelineResponse,
    summary="Get complete historical market event timeline",
)
def get_events_timeline(
    symbol: str,
    period: str = Query("3mo", description="Historical period: 1mo, 3mo, 6mo, 1y"),
):
    norm_symbol = _provider.normalize_symbol(symbol)
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

    engine = _get_engine(symbol, period=period)
    events = engine.generate_all_events()

    # Cache results
    _TIMELINE_CACHE[cache_key] = (now, events)

    return {
        "symbol": engine.symbol,
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
):
    engine = _get_engine(symbol, period=period)
    return engine.detect_events_at_step(step)
