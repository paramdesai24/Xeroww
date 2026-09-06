"""routes/patterns.py — GET /patterns/{symbol} endpoint."""

from fastapi import APIRouter, Depends, Path

from api.core.dependencies import get_market_provider
from api.schemas.pattern import PatternResponse
from api.services.yahoo_provider import SYMBOL_META
from api.services.pattern_service import detect_marubozu
from api.services.pattern_engine import scan_patterns
from api.services.contextual_pattern_service import enrich_pattern_with_context
from api.services.market_data_service import MarketDataService

router = APIRouter(tags=["Pattern Detection"])
provider = get_market_provider()


def _get_service() -> MarketDataService:
    return MarketDataService(provider)


@router.get(
    "/patterns/{symbol}",
    response_model=PatternResponse,
    summary="Detect candle patterns and contextual analysis",
)
async def get_patterns(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
) -> PatternResponse:
    """
    Detects candlestick patterns on the given symbol.
    Returns the Latest Candle Summary, Marubozu setup, scanned recent patterns,
    and contextual support/resistance & volume analysis.
    """
    sym, candles = market_data.get_candles(symbol, period="1mo", interval="1d")
    meta = SYMBOL_META.get(sym, {})
    result = detect_marubozu(
        candles=candles,
        symbol=sym,
        display_name=meta.get("display_name", sym),
    )

    # Pattern Engine V2 scan
    detected = scan_patterns(candles, lookback=5)
    result["detected_patterns"] = [d.to_dict() for d in detected]

    # Contextual enrichment if any patterns found
    if detected:
        ctx = enrich_pattern_with_context(detected[-1], candles, sym)
        result["contextual_pattern"] = ctx.to_dict()
    else:
        result["contextual_pattern"] = None

    return PatternResponse(**result)
