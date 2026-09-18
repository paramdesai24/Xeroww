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

from fastapi import APIRouter, Query, Depends
from api.core.dependencies import get_market_data_service
from api.services.market_data_service import MarketDataService
from api.analytics import default_orchestrator, AnalyticsOrchestrator
from api.schemas.replay import ReplayTimelineResponse, ReplayStepResponse
from api.services.health_registry import record_replay_access

router = APIRouter(prefix="/replay", tags=["Market Replay Engine"])
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
    market_data: MarketDataService = Depends(get_market_data_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_sym, candles = market_data.get_candles(symbol, period=period, interval="1d")
    record_replay_access(norm_sym, len(candles), 0)
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
    market_data: MarketDataService = Depends(get_market_data_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_sym, candles = market_data.get_candles(symbol, period=period, interval="1d")
    record_replay_access(norm_sym, len(candles), step)
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
    market_data: MarketDataService = Depends(get_market_data_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
):
    norm_sym, candles = market_data.get_candles(symbol, period=period, interval="1d")
    res = orchestrator.run_replay_jump(norm_sym, candles, timestamp)
    record_replay_access(norm_sym, len(candles), int(res["current_step"]))
    return res
