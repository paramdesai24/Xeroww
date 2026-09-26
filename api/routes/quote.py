"""routes/quote.py — GET /quote/{symbol} endpoint."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from api.core.dependencies import get_market_data_service
from api.data.nifty50 import NIFTY50
from api.schemas.quote import QuoteResponse, QuoteSnapshotResponse, QuoteSnapshotRow
from api.services.market_data_service import MarketDataService

router = APIRouter(tags=["Market Data"])
SUPPORTED_SYMBOLS = {stock["symbol"] for stock in NIFTY50}


@router.get(
    "/quotes",
    response_model=QuoteSnapshotResponse,
    summary="Get a bounded quote snapshot",
)
def get_quotes(
    symbols: str = Query(..., min_length=1, max_length=1000),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> QuoteSnapshotResponse:
    requested = list(dict.fromkeys(part.strip().upper() for part in symbols.split(",")))
    if (
        not requested
        or len(requested) > len(SUPPORTED_SYMBOLS)
        or any(symbol not in SUPPORTED_SYMBOLS for symbol in requested)
    ):
        raise HTTPException(
            status_code=422,
            detail="Choose up to 50 supported stock symbols.",
        )

    def read(symbol: str) -> QuoteSnapshotRow:
        try:
            return QuoteSnapshotRow(
                symbol=symbol,
                quote=QuoteResponse(**market_data.get_quote(symbol)),
                available=True,
            )
        except Exception:
            return QuoteSnapshotRow(
                symbol=symbol,
                available=False,
                reason="Market quote temporarily unavailable.",
            )

    with ThreadPoolExecutor(max_workers=min(5, len(requested))) as pool:
        rows = list(pool.map(read, requested))
    return QuoteSnapshotResponse(
        as_of=datetime.now(timezone.utc),
        data_note="Yahoo Finance delayed data. Not a live exchange feed.",
        rows=rows,
    )


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
