"""routes/patterns.py — GET /patterns/{symbol} endpoint."""

from fastapi import APIRouter, HTTPException, Path

from api.schemas.pattern import PatternResponse
from api.services.yahoo_provider import YahooFinanceProvider, SYMBOL_META
from api.services.pattern_service import detect_marubozu

router = APIRouter(tags=["Pattern Detection"])
provider = YahooFinanceProvider()


@router.get(
    "/patterns/{symbol}",
    response_model=PatternResponse,
    summary="Detect Marubozu candle patterns",
)
async def get_patterns(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> PatternResponse:
    """
    Detects whether the latest daily candle for the given symbol is a
    Bullish Marubozu, Bearish Marubozu, or neither.

    Also returns the Latest Candle Summary (body %, direction, range %) and
    a Varsity-aligned textbook trade setup with stop-loss and next-action guidance.

    Detection uses 1-month daily OHLC data from Yahoo Finance (near real-time, delayed).
    """
    sym = symbol.upper()
    try:
        candles = provider.get_ohlc(sym, period="1mo", interval="1d")
        meta = SYMBOL_META.get(sym, {})
        result = detect_marubozu(
            candles=candles,
            symbol=sym,
            display_name=meta.get("display_name", sym),
        )
        return PatternResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
