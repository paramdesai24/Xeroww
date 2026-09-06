"""routes/patterns.py — GET /patterns/{symbol} endpoint."""

from fastapi import APIRouter, HTTPException, Path

from api.schemas.pattern import PatternResponse
from api.services.yahoo_provider import YahooFinanceProvider, SYMBOL_META
from api.services.pattern_service import detect_marubozu
from api.services.pattern_engine import scan_patterns
from api.services.contextual_pattern_service import enrich_pattern_with_context

router = APIRouter(tags=["Pattern Detection"])
provider = YahooFinanceProvider()


@router.get(
    "/patterns/{symbol}",
    response_model=PatternResponse,
    summary="Detect candle patterns and contextual analysis",
)
async def get_patterns(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> PatternResponse:
    """
    Detects candlestick patterns on the given symbol.
    Returns the Latest Candle Summary, Marubozu setup, scanned recent patterns,
    and contextual support/resistance & volume analysis.
    """
    sym = provider.normalize_symbol(symbol)
    try:
        candles = provider.get_ohlc(sym, period="1mo", interval="1d")
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
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
