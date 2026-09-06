"""
routes/market_structure.py
──────────────────────────
FastAPI endpoints for deterministic Market Structure Engine V2:
  - /support-resistance/{symbol}
  - /volume/{symbol}
  - /moving-averages/{symbol}
  - /trend/{symbol}
  - /market-regime/{symbol}
  - /signal-alignment/{symbol}
  - /market-structure/{symbol} (unified summary)
"""

from fastapi import APIRouter, HTTPException, Path

from api.services.yahoo_provider import YahooFinanceProvider
from api.services.support_resistance_service import analyze_support_resistance
from api.services.volume_service import analyze_volume
from api.services.moving_average_service import analyze_moving_averages
from api.services.market_regime_service import classify_market_regime
from api.services.signal_alignment_service import evaluate_signal_alignment
from api.services.pattern_engine import scan_patterns
from api.services.contextual_pattern_service import enrich_pattern_with_context

from api.schemas.market_structure import (
    SupportResistanceResponse,
    VolumeAnalyticsResponse,
    MovingAveragesResponse,
    MarketRegimeResponse,
    SignalAlignmentResponse,
    MarketStructureSummaryResponse,
    PatternDetectionSchema,
    ContextualPatternSchema,
)

router = APIRouter(tags=["Market Structure Engine"])
provider = YahooFinanceProvider()


def _fetch_candles(symbol: str) -> tuple[str, list[dict]]:
    """Helper to normalize symbol and fetch historical candles."""
    sym = provider.normalize_symbol(symbol)
    try:
        candles = provider.get_ohlc(sym, period="1y", interval="1d")
        if not candles:
            raise ValueError(f"No OHLC data available for symbol {sym}.")
        return sym, candles
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error fetching candles: {exc}")


@router.get(
    "/support-resistance/{symbol}",
    response_model=SupportResistanceResponse,
    summary="Support and Resistance Zones",
)
def get_support_resistance(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> SupportResistanceResponse:
    sym, candles = _fetch_candles(symbol)
    analysis = analyze_support_resistance(candles, sym)
    return SupportResistanceResponse(**analysis.to_dict())


@router.get(
    "/volume/{symbol}",
    response_model=VolumeAnalyticsResponse,
    summary="Volume Analytics and RVOL",
)
def get_volume_analytics(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> VolumeAnalyticsResponse:
    sym, candles = _fetch_candles(symbol)
    analysis = analyze_volume(candles, sym)
    return VolumeAnalyticsResponse(**analysis.to_dict())


@router.get(
    "/moving-averages/{symbol}",
    response_model=MovingAveragesResponse,
    summary="Moving Averages (SMA 20/50/200, EMA 9/20)",
)
def get_moving_averages(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> MovingAveragesResponse:
    sym, candles = _fetch_candles(symbol)
    analysis = analyze_moving_averages(candles, sym)
    return MovingAveragesResponse(**analysis.to_dict())


@router.get(
    "/trend/{symbol}",
    response_model=MovingAveragesResponse,
    summary="Trend and Moving Averages alias",
)
def get_trend_alias(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> MovingAveragesResponse:
    return get_moving_averages(symbol)


@router.get(
    "/market-regime/{symbol}",
    response_model=MarketRegimeResponse,
    summary="Deterministic Market Regime Classification",
)
def get_market_regime(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> MarketRegimeResponse:
    sym, candles = _fetch_candles(symbol)
    analysis = classify_market_regime(candles, sym)
    return MarketRegimeResponse(**analysis.to_dict())


@router.get(
    "/signal-alignment/{symbol}",
    response_model=SignalAlignmentResponse,
    summary="Signal Alignment Confluence",
)
def get_signal_alignment(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> SignalAlignmentResponse:
    sym, candles = _fetch_candles(symbol)
    analysis = evaluate_signal_alignment(candles, sym)
    return SignalAlignmentResponse(**analysis.to_dict())


@router.get(
    "/market-structure/{symbol}",
    response_model=MarketStructureSummaryResponse,
    summary="Unified Market Structure Analytics (Single-Trip)",
)
def get_market_structure_summary(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
) -> MarketStructureSummaryResponse:
    sym, candles = _fetch_candles(symbol)
    current_price = float(candles[-1]["close"])

    sr = analyze_support_resistance(candles, sym)
    vol = analyze_volume(candles, sym)
    ma = analyze_moving_averages(candles, sym)
    regime = classify_market_regime(candles, sym)
    alignment = evaluate_signal_alignment(candles, sym)
    patterns = scan_patterns(candles, lookback=5)

    contextual = None
    if patterns:
        contextual = enrich_pattern_with_context(patterns[-1], candles, sym)

    return MarketStructureSummaryResponse(
        symbol=sym,
        current_price=round(current_price, 2),
        support_resistance=SupportResistanceResponse(**sr.to_dict()),
        volume=VolumeAnalyticsResponse(**vol.to_dict()),
        moving_averages=MovingAveragesResponse(**ma.to_dict()),
        market_regime=MarketRegimeResponse(**regime.to_dict()),
        signal_alignment=SignalAlignmentResponse(**alignment.to_dict()),
        detected_patterns=[PatternDetectionSchema(**p.to_dict()) for p in patterns],
        contextual_pattern=ContextualPatternSchema(**contextual.to_dict()) if contextual else None,
    )
