"""
api/analytics/orchestrator.py
─────────────────────────────
Unified Analytics Orchestrator.

Composes isolated calculation services (EMA, SMA, Volume, RVOL, Pattern, Structure, Support)
into deterministic analytical pipelines.

This is the architectural boundary seam for future Apache Spark distributed computation
and Kafka real-time stream consumers: routes call this orchestrator exclusively.
"""

from dataclasses import dataclass, asdict
from typing import Any

from api.analytics.ema import EMAService, PositionState, CrossoverState
from api.analytics.sma import SMAService
from api.analytics.volume import VolumeService, VolumeDTO
from api.analytics.rvol import RVOLService, RVOLDTO
from api.analytics.pattern import (
    PatternService,
    PatternDetectionDTO,
    ContextualPatternDTO,
    CandleSummaryDTO,
    MarubozuResultDTO,
)
from api.analytics.structure import (
    StructureService,
    MarketRegimeDTO,
    SignalAlignmentDTO,
    StructureDTO,
)
from api.analytics.support import SupportResistanceService, SRAnalysisDTO


@dataclass(frozen=True)
class MovingAveragesSnapshotDTO:
    symbol: str
    current_price: float
    sma_20: float | None
    sma_50: float | None
    sma_200: float | None
    ema_9: float | None
    ema_20: float | None
    price_vs_sma20: PositionState
    price_vs_sma50: PositionState
    price_vs_sma200: PositionState
    price_vs_ema9: PositionState
    price_vs_ema20: PositionState
    ema9_ema20_relationship: CrossoverState
    sma50_sma200_relationship: CrossoverState
    structural_summary: list[str]
    series: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class MarketStructureSummaryDTO:
    symbol: str
    current_price: float
    support_resistance: SRAnalysisDTO
    volume: VolumeDTO
    moving_averages: MovingAveragesSnapshotDTO
    market_regime: MarketRegimeDTO
    signal_alignment: SignalAlignmentDTO
    detected_patterns: list[PatternDetectionDTO]
    contextual_pattern: ContextualPatternDTO | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "current_price": self.current_price,
            "support_resistance": self.support_resistance.to_dict(),
            "volume": self.volume.to_dict(),
            "moving_averages": self.moving_averages.to_dict(),
            "market_regime": self.market_regime.to_dict(),
            "signal_alignment": self.signal_alignment.to_dict(),
            "detected_patterns": [p.to_dict() for p in self.detected_patterns],
            "contextual_pattern": self.contextual_pattern.to_dict() if self.contextual_pattern else None,
        }


class AnalyticsOrchestrator:
    """
    Central orchestration service composing pure analytics units.
    """

    def __init__(
        self,
        ema_service: type[EMAService] = EMAService,
        sma_service: type[SMAService] = SMAService,
        volume_service: type[VolumeService] = VolumeService,
        rvol_service: type[RVOLService] = RVOLService,
        pattern_service: type[PatternService] = PatternService,
        structure_service: type[StructureService] = StructureService,
        support_service: type[SupportResistanceService] = SupportResistanceService,
    ):
        self.ema = ema_service
        self.sma = sma_service
        self.volume = volume_service
        self.rvol = rvol_service
        self.pattern = pattern_service
        self.structure = structure_service
        self.support = support_service

    # -------------------------------------------------------------------------
    # Moving Averages Pipeline
    # -------------------------------------------------------------------------
    def run_moving_averages(
        self,
        candles: list[dict[str, Any]],
        symbol: str,
    ) -> MovingAveragesSnapshotDTO:
        """
        Execute full moving average pipeline across candle history.
        Composes SMAService and EMAService.
        """
        if not candles:
            return MovingAveragesSnapshotDTO(
                symbol=symbol,
                current_price=0.0,
                sma_20=None,
                sma_50=None,
                sma_200=None,
                ema_9=None,
                ema_20=None,
                price_vs_sma20="UNAVAILABLE",
                price_vs_sma50="UNAVAILABLE",
                price_vs_sma200="UNAVAILABLE",
                price_vs_ema9="UNAVAILABLE",
                price_vs_ema20="UNAVAILABLE",
                ema9_ema20_relationship="UNAVAILABLE",
                sma50_sma200_relationship="UNAVAILABLE",
                structural_summary=["Insufficient candle data for moving average calculation."],
                series=[],
            )

        closes = [float(c.get("close") or 0.0) for c in candles]
        times = [str(c.get("time", "")) for c in candles]
        current_price = closes[-1] if closes else 0.0

        sma20_series = self.sma.calculate_series(closes, 20)
        sma50_series = self.sma.calculate_series(closes, 50)
        sma200_series = self.sma.calculate_series(closes, 200)

        ema9_series = self.ema.calculate_series(closes, 9)
        ema20_series = self.ema.calculate_series(closes, 20)

        series_points: list[dict[str, Any]] = []
        for i in range(len(candles)):
            series_points.append({
                "time": times[i],
                "sma_20": sma20_series[i],
                "sma_50": sma50_series[i],
                "sma_200": sma200_series[i],
                "ema_9": ema9_series[i],
                "ema_20": ema20_series[i],
            })

        sma20_val = sma20_series[-1]
        sma50_val = sma50_series[-1]
        sma200_val = sma200_series[-1]
        ema9_val = ema9_series[-1]
        ema20_val = ema20_series[-1]

        pos_sma20 = self.sma.evaluate_position(current_price, sma20_val)
        pos_sma50 = self.sma.evaluate_position(current_price, sma50_val)
        pos_sma200 = self.sma.evaluate_position(current_price, sma200_val)
        pos_ema9 = self.ema.evaluate_position(current_price, ema9_val)
        pos_ema20 = self.ema.evaluate_position(current_price, ema20_val)

        ema_rel = self.ema.evaluate_crossover(ema9_series, ema20_series).relationship
        sma_rel = self.sma.evaluate_crossover(sma50_series, sma200_series).relationship

        summary: list[str] = []
        if ema9_val and ema20_val:
            summary.append(f"Short-term momentum: EMA9 (₹{ema9_val:.2f}) is {'above' if ema9_val >= ema20_val else 'below'} EMA20 (₹{ema20_val:.2f}) [{ema_rel}].")
        if sma20_val:
            summary.append(f"Price is {pos_sma20.lower()} 20-period SMA (₹{sma20_val:.2f}).")
        if sma50_val and sma200_val:
            summary.append(f"Macro structure: SMA50 is {'above' if sma50_val >= sma200_val else 'below'} SMA200 [{sma_rel}].")

        return MovingAveragesSnapshotDTO(
            symbol=symbol,
            current_price=round(current_price, 2),
            sma_20=round(sma20_val, 2) if sma20_val is not None else None,
            sma_50=round(sma50_val, 2) if sma50_val is not None else None,
            sma_200=round(sma200_val, 2) if sma200_val is not None else None,
            ema_9=round(ema9_val, 2) if ema9_val is not None else None,
            ema_20=round(ema20_val, 2) if ema20_val is not None else None,
            price_vs_sma20=pos_sma20,
            price_vs_sma50=pos_sma50,
            price_vs_sma200=pos_sma200,
            price_vs_ema9=pos_ema9,
            price_vs_ema20=pos_ema20,
            ema9_ema20_relationship=ema_rel,
            sma50_sma200_relationship=sma_rel,
            structural_summary=summary,
            series=series_points,
        )

    # -------------------------------------------------------------------------
    # Volume & RVOL Pipeline
    # -------------------------------------------------------------------------
    def run_volume(self, candles: list[dict[str, Any]], symbol: str, baseline_window: int = 20) -> VolumeDTO:
        return self.volume.analyze(candles, symbol=symbol, baseline_window=baseline_window)

    def run_rvol(self, candles: list[dict[str, Any]], baseline_window: int = 20) -> RVOLDTO:
        return self.rvol.compute_from_candles(candles, baseline_window=baseline_window)

    # -------------------------------------------------------------------------
    # Support & Resistance Pipeline
    # -------------------------------------------------------------------------
    def run_support_resistance(
        self,
        candles: list[dict[str, Any]],
        symbol: str,
        left_bars: int = 3,
        right_bars: int = 3,
        tolerance_pct: float = 0.012,
    ) -> SRAnalysisDTO:
        return self.support.analyze(
            candles,
            symbol=symbol,
            left_bars=left_bars,
            right_bars=right_bars,
            tolerance_pct=tolerance_pct,
        )

    # -------------------------------------------------------------------------
    # Structure Pipeline (Regime & Alignment)
    # -------------------------------------------------------------------------
    def run_market_regime(self, candles: list[dict[str, Any]], symbol: str) -> MarketRegimeDTO:
        return self.structure.classify_regime(candles, symbol)

    def run_signal_alignment(self, candles: list[dict[str, Any]], symbol: str) -> SignalAlignmentDTO:
        return self.structure.evaluate_alignment(candles, symbol)

    def run_structure(self, candles: list[dict[str, Any]], symbol: str) -> StructureDTO:
        return self.structure.analyze_structure(candles, symbol)

    # -------------------------------------------------------------------------
    # Pattern Recognition Pipeline
    # -------------------------------------------------------------------------
    def run_patterns(self, candles: list[dict[str, Any]], lookback: int = 5) -> list[PatternDetectionDTO]:
        return self.pattern.scan(candles, lookback=lookback)

    def run_contextual_pattern(
        self,
        pattern: PatternDetectionDTO | Any,
        candles: list[dict[str, Any]],
        symbol: str,
    ) -> ContextualPatternDTO | None:
        return self.pattern.enrich_context(pattern, candles, symbol)

    def run_candle_analysis(self, candle: dict[str, Any]) -> CandleSummaryDTO:
        return self.pattern.analyse_candle(candle)

    def parse_ohlc_bars(self, candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize and validate raw OHLC candle records for client charts."""
        return [
            {
                "time": str(c.get("time", "")),
                "open": round(float(c.get("open", 0.0)), 2),
                "high": round(float(c.get("high", 0.0)), 2),
                "low": round(float(c.get("low", 0.0)), 2),
                "close": round(float(c.get("close", 0.0)), 2),
                "volume": round(float(c.get("volume", 0.0)), 2),
            }
            for c in candles
        ]

    def run_marubozu(self, candles: list[dict[str, Any]], symbol: str, display_name: str) -> MarubozuResultDTO:
        return self.pattern.detect_marubozu(candles, symbol, display_name)

    # -------------------------------------------------------------------------
    # Replay & Event Engine Orchestration
    # -------------------------------------------------------------------------
    def run_replay_timeline(self, symbol: str, candles: list[dict[str, Any]]) -> dict[str, Any]:
        from api.services.replay_service import ReplayEngine
        engine = ReplayEngine(symbol=symbol, all_candles=candles)
        return {
            "symbol": engine.symbol,
            "total_bars": engine.total_bars,
            "timeline": engine.get_timeline(),
        }

    def run_replay_step(self, symbol: str, candles: list[dict[str, Any]], step: int) -> dict[str, Any]:
        from api.services.replay_service import ReplayEngine
        engine = ReplayEngine(symbol=symbol, all_candles=candles)
        return engine.evaluate_at_step(step)

    def run_replay_jump(self, symbol: str, candles: list[dict[str, Any]], timestamp: str) -> dict[str, Any]:
        from api.services.replay_service import ReplayEngine
        engine = ReplayEngine(symbol=symbol, all_candles=candles)
        return engine.evaluate_at_timestamp(timestamp)

    def run_events_timeline(self, symbol: str, candles: list[dict[str, Any]]) -> list[Any]:
        from api.services.event_engine import EventEngine
        engine = EventEngine(symbol=symbol, all_candles=candles)
        return engine.generate_all_events()

    def run_events_at_step(self, symbol: str, candles: list[dict[str, Any]], step: int) -> list[Any]:
        from api.services.event_engine import EventEngine
        engine = EventEngine(symbol=symbol, all_candles=candles)
        return engine.detect_events_at_step(step)

    # -------------------------------------------------------------------------
    # Full Unified Analytics Suite (Single-Trip)
    # -------------------------------------------------------------------------
    def run_market_structure_summary(
        self,
        candles: list[dict[str, Any]],
        symbol: str,
    ) -> MarketStructureSummaryDTO:
        """
        Execute the unified single-trip market structure analytical pipeline.
        Composes all analytical sub-pipelines into a cohesive analytical snapshot.
        """
        curr_price = float(candles[-1]["close"]) if candles else 0.0

        sr = self.run_support_resistance(candles, symbol)
        vol = self.run_volume(candles, symbol)
        ma = self.run_moving_averages(candles, symbol)
        regime = self.run_market_regime(candles, symbol)
        alignment = self.run_signal_alignment(candles, symbol)
        patterns = self.run_patterns(candles, lookback=5)

        contextual = None
        if patterns:
            contextual = self.run_contextual_pattern(patterns[-1], candles, symbol)

        return MarketStructureSummaryDTO(
            symbol=symbol,
            current_price=round(curr_price, 2),
            support_resistance=sr,
            volume=vol,
            moving_averages=ma,
            market_regime=regime,
            signal_alignment=alignment,
            detected_patterns=patterns,
            contextual_pattern=contextual,
        )


# Global singleton instance for easy route injection and dependency override
default_orchestrator = AnalyticsOrchestrator()
