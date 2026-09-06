"""routes/stocks.py — GET /stocks endpoint."""

from typing import Any
from fastapi import APIRouter, Depends

from api.core.dependencies import get_market_data_service
from api.services.market_data_service import MarketDataService

router = APIRouter(tags=["Market Data"])


@router.get("/stocks", summary="Get watchlist")
async def get_stocks(
    market_data: MarketDataService = Depends(get_market_data_service),
) -> list[dict[str, Any]]:
    """
    Returns the predefined Xeroww Indian stock watchlist.

    Includes: RELIANCE.NS, TCS.NS, INFY.NS, HDFCBANK.NS, ICICIBANK.NS
    with human-readable names, exchange, and sector metadata.
    """
    return market_data.get_stocks()
