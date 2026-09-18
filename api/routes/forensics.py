"""
routes/forensics.py
───────────────────
REST API endpoints for Candle Forensics & Data Provenance metadata.
"""

from fastapi import APIRouter, Query, Depends
from api.core.dependencies import get_market_data_service
from api.services.market_data_service import MarketDataService
from api.services.forensic_service import CandleForensicsService

router = APIRouter(prefix="/forensics", tags=["Candle Forensics & Provenance"])


@router.get(
    "/inspect/{symbol}",
    summary="Deep deterministic candle forensics and provenance inspection",
)
def inspect_candle(
    symbol: str,
    timestamp: str = Query(..., description="Timestamp of the candle to inspect (YYYY-MM-DD)"),
    period: str = Query("6mo", description="Historical period for context"),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    sym, candles = market_data.get_candles(symbol, period=period, interval="1d")
    service = CandleForensicsService(
        sym,
        candles,
        provider_name=market_data.provider.__class__.__name__,
    )
    return service.inspect_candle(timestamp)
