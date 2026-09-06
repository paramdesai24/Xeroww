"""
routes/intelligence.py
─────────────────────
REST API endpoints for Market Breadth and Cross-Asset Correlation Explorer.
"""

from fastapi import APIRouter, Query
from api.services.yahoo_provider import YahooFinanceProvider
from api.services.market_breadth_service import MarketBreadthService
from api.services.correlation_service import CorrelationService

router = APIRouter(prefix="/intelligence", tags=["Market Breadth & Cross-Asset Relationships"])
_provider = YahooFinanceProvider()
_breadth_svc = MarketBreadthService(_provider)
_corr_svc = CorrelationService(_provider)


@router.get("/breadth", summary="Get market breadth and advance-decline distribution")
def get_market_breadth():
    return _breadth_svc.compute_breadth()


@router.get("/correlation/pairwise", summary="Get pairwise rolling correlation between two symbols")
def get_pairwise_correlation(
    symbol_a: str = Query(..., description="First symbol, e.g., RELIANCE.NS"),
    symbol_b: str = Query(..., description="Second symbol, e.g., TCS.NS"),
    window: int = Query(20, description="Rolling window (e.g. 20 or 50)"),
):
    return _corr_svc.compute_pairwise(symbol_a, symbol_b, window=window)


@router.get("/correlation/matrix", summary="Get correlation matrix across universe")
def get_correlation_matrix(
    window: int = Query(20, description="Correlation window (e.g. 20 or 50)"),
):
    stocks = _provider.get_stocks()
    symbols = [s["symbol"] for s in stocks]
    return _corr_svc.compute_matrix(symbols, window=window)
