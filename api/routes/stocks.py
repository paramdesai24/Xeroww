"""routes/stocks.py — GET /stocks endpoint."""

from fastapi import APIRouter, HTTPException
from typing import Any

from api.services.yahoo_provider import YahooFinanceProvider

router = APIRouter(tags=["Market Data"])
provider = YahooFinanceProvider()


@router.get("/stocks", summary="Get watchlist")
async def get_stocks() -> list[dict[str, Any]]:
    """
    Returns the predefined Xeroww Indian stock watchlist.

    Includes: RELIANCE.NS, TCS.NS, INFY.NS, HDFCBANK.NS, ICICIBANK.NS
    with human-readable names, exchange, and sector metadata.
    """
    try:
        return provider.get_stocks()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
