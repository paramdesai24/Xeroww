"""
routes/forensics.py
───────────────────
REST API endpoints for Candle Forensics & Data Provenance metadata.
"""

from fastapi import APIRouter, HTTPException, Query, status
from api.services.yahoo_provider import YahooFinanceProvider
from api.services.forensic_service import CandleForensicsService

router = APIRouter(prefix="/forensics", tags=["Candle Forensics & Provenance"])
_provider = YahooFinanceProvider()


@router.get(
    "/inspect/{symbol}",
    summary="Deep deterministic candle forensics and provenance inspection",
)
def inspect_candle(
    symbol: str,
    timestamp: str = Query(..., description="Timestamp of the candle to inspect (YYYY-MM-DD)"),
    period: str = Query("6mo", description="Historical period for context"),
):
    sym = _provider.normalize_symbol(symbol)
    try:
        candles = _provider.get_ohlc(sym, period=period, interval="1d")
        service = CandleForensicsService(sym, candles)
        return service.inspect_candle(timestamp)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Market data error: {e}")
