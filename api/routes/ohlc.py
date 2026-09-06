"""routes/ohlc.py — GET /ohlc/{symbol} endpoint."""

from fastapi import APIRouter, Depends, Path, Query

from api.core.dependencies import get_market_data_service
from api.schemas.ohlc import OHLCResponse, OHLCBar
from api.services.yahoo_provider import SYMBOL_META
from api.services.market_data_service import MarketDataService

router = APIRouter(tags=["Market Data"])


@router.get(
    "/ohlc/{symbol}",
    response_model=OHLCResponse,
    summary="Get historical OHLC candlestick data",
)
async def get_ohlc(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    period: str = Query(default="1mo", description="Data period: 1mo, 3mo, 6mo, 1y"),
    interval: str = Query(default="1d", description="Candle interval: 1d, 1wk"),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> OHLCResponse:
    """
    Returns historical OHLCV candlestick data for the given symbol.

    The response format is directly compatible with TradingView Lightweight Charts
    (time field is YYYY-MM-DD string). Data is from the configured MarketDataProvider.
    """
    sym, candles_raw = market_data.get_candles(symbol, period=period, interval=interval)
    candles = [OHLCBar(**c) for c in candles_raw]
    meta = SYMBOL_META.get(sym, {})
    return OHLCResponse(
        symbol=sym,
        display_name=meta.get("display_name", sym),
        period=period,
        interval=interval,
        candles=candles,
    )
