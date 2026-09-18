"""
routes/diff.py
──────────────
REST API endpoints for the Deterministic Event-Diff ("What Changed?").
"""

from fastapi import APIRouter, Query, Depends
from api.core.dependencies import get_market_data_service
from api.services.market_data_service import MarketDataService
from api.services.event_diff_service import EventDiffService

router = APIRouter(prefix="/event-diff", tags=["Event Diff Engine"])
def _get_service(
    symbol: str,
    period: str,
    market_data: MarketDataService,
) -> EventDiffService:
    normalized, candles = market_data.get_candles(symbol, period=period, interval="1d")
    return EventDiffService(symbol=normalized, all_candles=candles)


@router.get(
    "/latest/{symbol}",
    summary="Get 'What Changed?' diff between previous and latest session",
)
def get_latest_diff(
    symbol: str,
    period: str = Query("1mo", description="Historical period"),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _get_service(symbol, period, market_data)
    return service.diff_latest()


@router.get(
    "/compare/{symbol}",
    summary="Get 'What Changed?' diff between any two historical step indices",
)
def compare_steps(
    symbol: str,
    from_step: int = Query(..., ge=0, description="Starting step index"),
    to_step: int = Query(..., ge=1, description="Ending step index"),
    period: str = Query("1mo", description="Historical period"),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _get_service(symbol, period, market_data)
    return service.diff_steps(from_step, to_step)
