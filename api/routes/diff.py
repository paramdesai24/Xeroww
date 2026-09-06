"""
routes/diff.py
──────────────
REST API endpoints for the Deterministic Event-Diff ("What Changed?").
"""

from fastapi import APIRouter, HTTPException, Query, status
from api.services.yahoo_provider import YahooFinanceProvider
from api.services.event_diff_service import EventDiffService

router = APIRouter(prefix="/event-diff", tags=["Event Diff Engine"])
_provider = YahooFinanceProvider()


def _get_service(symbol: str, period: str = "1mo") -> EventDiffService:
    try:
        candles = _provider.get_ohlc(symbol, period=period, interval="1d")
        return EventDiffService(symbol=_provider.normalize_symbol(symbol), all_candles=candles)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data error: {e}")


@router.get(
    "/latest/{symbol}",
    summary="Get 'What Changed?' diff between previous and latest session",
)
def get_latest_diff(symbol: str, period: str = Query("1mo", description="Historical period")):
    service = _get_service(symbol, period=period)
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
):
    service = _get_service(symbol, period=period)
    return service.diff_steps(from_step, to_step)
