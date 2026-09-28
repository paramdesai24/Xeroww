"""
routes/ohlc.py
──────────────
FastAPI endpoint for historical candlestick OHLC data:
  - GET /ohlc/{symbol}

Routes delegate candle normalization to AnalyticsOrchestrator.
"""

from fastapi import APIRouter, Depends, Path, Query

from api.core.dependencies import get_market_data_service
from api.schemas.ohlc import OHLCResponse, OHLCBar
from api.services.market_data_service import MarketDataService
from api.analytics import default_orchestrator, AnalyticsOrchestrator
from api.services.yahoo_provider import INDEX_META

router = APIRouter(tags=["Market Data"])


def _get_orchestrator() -> AnalyticsOrchestrator:
    return default_orchestrator


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
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> OHLCResponse:
    """
    Returns historical OHLCV candlestick data for the given symbol.

    The response format is directly compatible with TradingView Lightweight Charts
    (time field is YYYY-MM-DD string). Data is from the configured MarketDataProvider.
    """
    sym, candles_raw = market_data.get_candles(symbol, period=period, interval=interval)
    normalized_bars = orchestrator.parse_ohlc_bars(candles_raw)
    candles = [OHLCBar(**c) for c in normalized_bars]
    meta = next((item for item in market_data.get_stocks() if item["symbol"] == sym), INDEX_META.get(sym, {}))
    return OHLCResponse(
        symbol=sym,
        display_name=meta.get("display_name", sym),
        period=period,
        interval=interval,
        candles=candles,
    )
