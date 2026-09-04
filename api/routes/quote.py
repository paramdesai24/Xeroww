"""routes/quote.py — GET /quote/{symbol} endpoint."""

from fastapi import APIRouter, HTTPException, Path

from api.schemas.quote import QuoteResponse
from api.services.yahoo_provider import YahooFinanceProvider

router = APIRouter(tags=["Market Data"])
provider = YahooFinanceProvider()


@router.get(
    "/quote/{symbol}",
    response_model=QuoteResponse,
    summary="Get latest market quote",
)
async def get_quote(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> QuoteResponse:
    """
    Returns the latest market quote for the given NSE stock symbol.

    Includes: price, previous close, change, day high/low, volume, market cap.
    Data is sourced from Yahoo Finance (near real-time, delayed ~15–20 minutes for NSE).
    """
    try:
        data = provider.get_quote(symbol.upper())
        return QuoteResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
