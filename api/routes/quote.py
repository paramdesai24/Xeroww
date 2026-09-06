"""routes/quote.py — GET /quote/{symbol} endpoint."""

from fastapi import APIRouter, Depends, Path

from api.core.dependencies import get_market_data_service
from api.schemas.quote import QuoteResponse
from api.services.market_data_service import MarketDataService

router = APIRouter(tags=["Market Data"])


@router.get(
    "/quote/{symbol}",
    response_model=QuoteResponse,
    summary="Get latest market quote",
)
async def get_quote(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> QuoteResponse:
    """
    Returns the latest market quote for the given NSE stock symbol.

    Includes: price, previous close, change, day high/low, volume, market cap.
    Data is sourced from the configured MarketDataProvider (near real-time, delayed ~15–20 minutes for NSE).
    """
    data = market_data.get_quote(symbol)
    return QuoteResponse(**data)
