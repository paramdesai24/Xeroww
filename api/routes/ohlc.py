"""routes/ohlc.py — GET /ohlc/{symbol} endpoint."""

from fastapi import APIRouter, HTTPException, Path, Query

from api.schemas.ohlc import OHLCResponse, OHLCBar
from api.services.yahoo_provider import YahooFinanceProvider, SYMBOL_META

router = APIRouter(tags=["Market Data"])
provider = YahooFinanceProvider()


@router.get(
    "/ohlc/{symbol}",
    response_model=OHLCResponse,
    summary="Get historical OHLC candlestick data",
)
async def get_ohlc(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    period: str = Query(default="1mo", description="Data period: 1mo, 3mo, 6mo, 1y"),
    interval: str = Query(default="1d", description="Candle interval: 1d, 1wk"),
) -> OHLCResponse:
    """
    Returns historical OHLCV candlestick data for the given symbol.

    The response format is directly compatible with TradingView Lightweight Charts
    (time field is YYYY-MM-DD string). Data is from Yahoo Finance (near real-time, delayed).
    """
    sym = provider.normalize_symbol(symbol)
    try:
        candles_raw = provider.get_ohlc(sym, period=period, interval=interval)
        candles = [OHLCBar(**c) for c in candles_raw]
        meta = SYMBOL_META.get(sym, {})
        return OHLCResponse(
            symbol=sym,
            display_name=meta.get("display_name", sym),
            period=period,
            interval=interval,
            candles=candles,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
