"""
routes/replay.py
────────────────
REST API endpoints for the Historical Market Replay Engine.

Endpoints:
- GET /api/replay/timeline/{symbol} — Returns bar timeline for scrubber
- GET /api/replay/step/{symbol}?step=N — Evaluates full market structure state at step N without future leakage
- GET /api/replay/jump/{symbol}?timestamp=T — Evaluates state at or closest preceding timestamp T
"""

from fastapi import APIRouter, HTTPException, Query, status
from api.services.yahoo_provider import YahooFinanceProvider
from api.services.replay_service import ReplayEngine
from api.schemas.replay import ReplayTimelineResponse, ReplayStepResponse

router = APIRouter(prefix="/replay", tags=["Market Replay Engine"])
_provider = YahooFinanceProvider()


def _get_engine(symbol: str, period: str = "1mo") -> ReplayEngine:
    try:
        candles = _provider.get_ohlc(symbol, period=period, interval="1d")
        return ReplayEngine(symbol=_provider.normalize_symbol(symbol), all_candles=candles)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data error: {e}")


@router.get(
    "/timeline/{symbol}",
    response_model=ReplayTimelineResponse,
    summary="Get replay scrubber timeline",
)
def get_timeline(symbol: str, period: str = Query("1mo", description="Historical period: 1mo, 3mo, 6mo, 1y")):
    engine = _get_engine(symbol, period=period)
    timeline = engine.get_timeline()
    return {
        "symbol": engine.symbol,
        "total_bars": engine.total_bars,
        "timeline": timeline,
    }


@router.get(
    "/step/{symbol}",
    response_model=ReplayStepResponse,
    summary="Evaluate historical market structure at step N",
)
def evaluate_step(
    symbol: str,
    step: int = Query(..., ge=0, description="Step index (0 to total_bars-1)"),
    period: str = Query("1mo", description="Historical period"),
):
    engine = _get_engine(symbol, period=period)
    return engine.evaluate_at_step(step)


@router.get(
    "/jump/{symbol}",
    response_model=ReplayStepResponse,
    summary="Jump replay to specific timestamp",
)
def evaluate_timestamp(
    symbol: str,
    timestamp: str = Query(..., description="Timestamp in YYYY-MM-DD format"),
    period: str = Query("1mo", description="Historical period"),
):
    engine = _get_engine(symbol, period=period)
    return engine.evaluate_at_timestamp(timestamp)
