"""
api/routes/fuzzy.py
────────────────────────────────────────────────────────────────────────────
REST API endpoint for the Mamdani Fuzzy Explainability Engine.

GET /fuzzy/explain?symbol=RELIANCE.NS&period=1y

Returns a FuzzyExplainabilityReport — a fully auditable linguistic
interpretation of current market conditions across 4 FIS dimensions:
  • Momentum  (EMA spread × price position)
  • Volume    (RVOL × volume trend)
  • Trend     (price vs SMA-200 × signal alignment)
  • Structure (SR zone proximity × market regime strength)

This endpoint is READ-ONLY. It does NOT:
  - Write to the database
  - Publish events
  - Provide buy/sell signals
  - Use machine learning

All results are deterministic on the input candle data.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import JSONResponse

from api.core.dependencies import get_market_data_service
from api.services.market_data_service import MarketDataService
from api.fuzzy.orchestrator import default_fuzzy_orchestrator, FuzzyExplainabilityReport

router = APIRouter(prefix="/fuzzy", tags=["Fuzzy Explainability Engine"])

@router.get(
    "/explain",
    summary="Get Mamdani Fuzzy Explainability Report for a symbol",
    description=(
        "Runs the full Mamdani Fuzzy Inference System pipeline on historical OHLCV data "
        "for the given symbol. Returns a structured linguistic interpretation across 4 "
        "dimensions: Momentum, Volume, Trend, and Structure. "
        "\n\n"
        "**Not a buy/sell signal. Not ML. Not a prediction.** "
        "Pure linguistic classification of current analytical state."
    ),
    response_description="FuzzyExplainabilityReport with 4 FIS dimensions and overall composite label",
)
def get_fuzzy_explain(
    symbol: str = Query(
        ...,
        description="NSE symbol (e.g., RELIANCE.NS, TCS.NS)",
        min_length=2,
        max_length=50,
    ),
    period: str = Query(
        "1y",
        description="Historical data period (e.g., '6mo', '1y', '2y'). Longer = richer SR zones.",
    ),
    market_data: MarketDataService = Depends(get_market_data_service),
) -> JSONResponse:
    """
    Evaluate the Mamdani Fuzzy Inference System for the requested symbol.

    Returns a complete FuzzyExplainabilityReport including:
    - Per-dimension labels, activations, membership function values
    - All evaluated Mamdani rules (fired and non-fired) for transparency
    - Human-readable narratives per dimension
    - Composite overall label and activation score
    - Methodology note emphasising non-predictive nature
    """
    normalized_symbol, candles = market_data.get_candles(
        symbol,
        period=period,
        interval="1d",
    )

    if not candles:
        raise HTTPException(
            status_code=404,
            detail=f"No OHLCV data returned for symbol '{symbol}' with period '{period}'.",
        )

    # Run Mamdani FIS pipeline
    try:
        report: FuzzyExplainabilityReport = default_fuzzy_orchestrator.explain(
            candles=candles,
            symbol=normalized_symbol,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Fuzzy inference error for '{symbol}': {exc}",
        ) from exc

    return JSONResponse(content=report.to_dict())
