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

Architectural Boundary: Routes delegate exclusively to AnalyticsOrchestrator.
No routes directly touch internal analytical services.
"""

from fastapi import APIRouter, Depends, Path

from api.core.dependencies import get_market_provider
from api.services.market_data_service import MarketDataService
from api.analytics import default_orchestrator, AnalyticsOrchestrator

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
provider = get_market_provider()


def _get_service() -> MarketDataService:
    return MarketDataService(provider)


def _get_orchestrator() -> AnalyticsOrchestrator:
    return default_orchestrator


@router.get(
    "/support-resistance/{symbol}",
    response_model=SupportResistanceResponse,
    summary="Support and Resistance Zones",
)
def get_support_resistance(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> SupportResistanceResponse:
    sym, candles = market_data.get_candles(symbol, period="1y", interval="1d")
    analysis = orchestrator.run_support_resistance(candles, sym)
    return SupportResistanceResponse(**analysis.to_dict())


@router.get(
    "/volume/{symbol}",
    response_model=VolumeAnalyticsResponse,
    summary="Volume Analytics and RVOL",
)
def get_volume_analytics(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> VolumeAnalyticsResponse:
    sym, candles = market_data.get_candles(symbol, period="1y", interval="1d")
    analysis = orchestrator.run_volume(candles, sym)
    return VolumeAnalyticsResponse(**analysis.to_dict())


@router.get(
    "/moving-averages/{symbol}",
    response_model=MovingAveragesResponse,
    summary="Moving Averages (SMA 20/50/200, EMA 9/20)",
)
def get_moving_averages(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> MovingAveragesResponse:
    sym, candles = market_data.get_candles(symbol, period="1y", interval="1d")
    analysis = orchestrator.run_moving_averages(candles, sym)
    return MovingAveragesResponse(**analysis.to_dict())


@router.get(
    "/trend/{symbol}",
    response_model=MovingAveragesResponse,
    summary="Trend and Moving Averages alias",
)
def get_trend_alias(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> MovingAveragesResponse:
    return get_moving_averages(symbol, market_data=market_data, orchestrator=orchestrator)


@router.get(
    "/market-regime/{symbol}",
    response_model=MarketRegimeResponse,
    summary="Deterministic Market Regime Classification",
)
def get_market_regime(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> MarketRegimeResponse:
    sym, candles = market_data.get_candles(symbol, period="1y", interval="1d")
    analysis = orchestrator.run_market_regime(candles, sym)
    return MarketRegimeResponse(**analysis.to_dict())


@router.get(
    "/signal-alignment/{symbol}",
    response_model=SignalAlignmentResponse,
    summary="Signal Alignment Confluence",
)
def get_signal_alignment(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> SignalAlignmentResponse:
    sym, candles = market_data.get_candles(symbol, period="1y", interval="1d")
    analysis = orchestrator.run_signal_alignment(candles, sym)
    return SignalAlignmentResponse(**analysis.to_dict())


@router.get(
    "/market-structure/{symbol}",
    response_model=MarketStructureSummaryResponse,
    summary="Unified Market Structure Analytics (Single-Trip)",
)
def get_market_structure_summary(
    symbol: str = Path(..., description="NSE ticker symbol, e.g., RELIANCE.NS"),
    market_data: MarketDataService = Depends(_get_service),
    orchestrator: AnalyticsOrchestrator = Depends(_get_orchestrator),
) -> MarketStructureSummaryResponse:
    sym, candles = market_data.get_candles(symbol, period="1y", interval="1d")
    summary = orchestrator.run_market_structure_summary(candles, sym)

    return MarketStructureSummaryResponse(
        symbol=summary.symbol,
        current_price=summary.current_price,
        support_resistance=SupportResistanceResponse(**summary.support_resistance.to_dict()),
        volume=VolumeAnalyticsResponse(**summary.volume.to_dict()),
        moving_averages=MovingAveragesResponse(**summary.moving_averages.to_dict()),
        market_regime=MarketRegimeResponse(**summary.market_regime.to_dict()),
        signal_alignment=SignalAlignmentResponse(**summary.signal_alignment.to_dict()),
        detected_patterns=[PatternDetectionSchema(**p.to_dict()) for p in summary.detected_patterns],
        contextual_pattern=ContextualPatternSchema(**summary.contextual_pattern.to_dict()) if summary.contextual_pattern else None,
    )
