"""
routes/replay.py
────────────────
REST API endpoints for the Historical Market Replay Engine.

Endpoints:
- GET /api/replay/timeline/{symbol} — Returns bar timeline for scrubber
- GET /api/replay/step/{symbol}?step=N — Evaluates full market structure state at step N without future leakage
- GET /api/replay/jump/{symbol}?timestamp=T — Evaluates state at or closest preceding timestamp T

Routes delegate replay analytics directly to AnalyticsOrchestrator.
"""

from fastapi import APIRouter, HTTPException, Query, Depends, status
from api.services.yahoo_provider import YahooFinanceProvider
from api.analytics import default_orchestrator, AnalyticsOrchestrator
from api.schemas.replay import ReplayTimelineResponse, ReplayStepResponse

router = APIRouter(prefix="/replay", tags=["Market Replay Engine"])
_provider = YahooFinanceProvider()


def _get_candles(symbol: str, period: str = "1mo") -> tuple[str, list[dict]]:
    try:
        norm_sym = _provider.normalize_symbol(symbol)
        candles = _provider.get_ohlc(symbol, period=period, interval="1d")
        return norm_sym, candles
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data error: {e}")


def _get_orchestrator() -> AnalyticsOrchestrator:
    return default_orchestrator


@router.get(
    "/timeline/{symbol}",
    response_model=ReplayTimelineResponse,
    summary="Get replay scrubber timeline",
)
def get_timeline(
    symbol: str,
    period: str = Query("1mo", description="Historical period: 1mo, 3mo, 6mo, 1y"),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_sym, candles = _get_candles(symbol, period=period)
    return orchestrator.run_replay_timeline(norm_sym, candles)


@router.get(
    "/step/{symbol}",
    response_model=ReplayStepResponse,
    summary="Evaluate historical market structure at step N",
)
def evaluate_step(
    symbol: str,
    step: int = Query(..., ge=0, description="Step index (0 to total_bars-1)"),
    period: str = Query("1mo", description="Historical period"),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_sym, candles = _get_candles(symbol, period=period)
    return orchestrator.run_replay_step(norm_sym, candles, step)


@router.get(
    "/jump/{symbol}",
    response_model=ReplayStepResponse,
    summary="Jump replay to specific timestamp",
)
def evaluate_timestamp(
    symbol: str,
    timestamp: str = Query(..., description="Timestamp in YYYY-MM-DD format"),
    period: str = Query("1mo", description="Historical period"),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_sym, candles = _get_candles(symbol, period=period)
    return orchestrator.run_replay_jump(norm_sym, candles, timestamp)
