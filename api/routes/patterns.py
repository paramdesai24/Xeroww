"""
routes/patterns.py
──────────────────
FastAPI endpoint for candlestick pattern recognition:
  - GET /patterns/{symbol}

Routes delegate pattern recognition and contextual analysis to AnalyticsOrchestrator.
"""

from fastapi import APIRouter, Depends, Path

from api.core.dependencies import get_market_data_service
from api.schemas.pattern import PatternResponse
from api.services.market_data_service import MarketDataService
from api.analytics import default_orchestrator, AnalyticsOrchestrator

router = APIRouter(tags=["Pattern Detection"])


def _get_orchestrator() -> AnalyticsOrchestrator:
    return default_orchestrator


@router.get(
    "/patterns/{symbol}",
    response_model=PatternResponse,
    summary="Detect candle patterns and contextual analysis",
)
async def get_patterns(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(get_market_data_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> PatternResponse:
    """
    Detects candlestick patterns on the given symbol.
    Returns the Latest Candle Summary, Marubozu setup, scanned recent patterns,
    and contextual support/resistance & volume analysis.
    """
    sym, candles = market_data.get_candles(symbol, period="1mo", interval="1d")
    meta = next((item for item in market_data.get_stocks() if item["symbol"] == sym), {})
    marubozu_dto = orchestrator.run_marubozu(
        candles=candles,
        symbol=sym,
        display_name=meta.get("display_name", sym),
    )
    result = marubozu_dto.to_dict()

    # Pattern Engine V2 scan via orchestrator
    detected = orchestrator.run_patterns(candles, lookback=5, symbol=sym)
    result["detected_patterns"] = [d.to_dict() for d in detected]


    # Contextual enrichment if any patterns found
    if detected:
        ctx = orchestrator.run_contextual_pattern(detected[-1], candles, sym)
        result["contextual_pattern"] = ctx.to_dict() if ctx else None
    else:
        result["contextual_pattern"] = None

    return PatternResponse(**result)
