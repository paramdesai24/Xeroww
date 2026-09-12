"""
api/fuzzy/orchestrator.py
────────────────────────────────────────────────────────────────────────────
FuzzyOrchestrator — Unified Mamdani FIS Composition Layer.

Sits above AnalyticsOrchestrator. Accepts candle data and symbol, runs the
full analytics pipeline internally, extracts crisp numeric inputs for each
FIS dimension, evaluates all 4 FIS in parallel (in-process), and assembles
a complete FuzzyExplainabilityReport.

Architecture
────────────
  AnalyticsOrchestrator.run_market_structure_summary(candles, symbol)
     └─→ MarketStructureSummaryDTO
           ├── EMA-9, EMA-20, SMA-200 values
           ├── RVOL, Volume
           ├── SignalAlignmentDTO (bullish/bearish counts)
           ├── MarketRegimeDTO (regime label)
           └── SRAnalysisDTO (SR zones)
     └─→ MomentumFIS.evaluate(MomentumInputs)
     └─→ VolumeFIS.evaluate(VolumeInputs)
     └─→ TrendFIS.evaluate(TrendInputs)
     └─→ StructureFIS.evaluate(StructureInputs)
     └─→ FuzzyExplainabilityReport

Overall label composite formula:
  weighted_score = (momentum.activation × 0.30)
                 + (volume.activation   × 0.20)
                 + (trend.activation    × 0.35)
                 + (structure.activation× 0.15)

Weights are hard-coded constants — NOT learned, NOT tuned on historical data.

This module NEVER:
  - Writes to the database
  - Publishes events to the event bus
  - Modifies any analytics DTO
  - Labels output as "buy", "sell", "target", or "stop loss"
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from api.analytics.orchestrator import AnalyticsOrchestrator, default_orchestrator
from api.fuzzy.dimensions.momentum import MomentumFIS
from api.fuzzy.dimensions.volume import VolumeFIS
from api.fuzzy.dimensions.trend import TrendFIS
from api.fuzzy.dimensions.structure import StructureFIS


# ---------------------------------------------------------------------------
# Weight configuration (non-learned constants)
# ---------------------------------------------------------------------------

DIMENSION_WEIGHTS: dict[str, float] = {
    "momentum": 0.30,
    "volume":   0.20,
    "trend":    0.35,
    "structure": 0.15,
}

# Composite label thresholds (applied to weighted activation score)
_OVERALL_THRESHOLDS: list[tuple[float, str]] = [
    (0.80, "STRONGLY_BULLISH"),
    (0.62, "MODERATELY_BULLISH"),
    (0.48, "NEUTRAL"),
    (0.32, "MODERATELY_BEARISH"),
    (0.00, "STRONGLY_BEARISH"),
]


def _composite_label(weighted_score: float) -> str:
    """Map a weighted activation score [0,1] to an overall linguistic label."""
    for threshold, label in _OVERALL_THRESHOLDS:
        if weighted_score >= threshold:
            return label
    return "STRONGLY_BEARISH"


# ---------------------------------------------------------------------------
# Typed output DTOs
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FuzzyDimension:
    """
    Result for a single FIS dimension.

    Attributes
    ----------
    name        : "momentum" | "volume" | "trend" | "structure"
    label       : winning linguistic term (e.g. "STRONG", "ELEVATED")
    activation  : defuzzified activation strength [0.0–1.0]
    activations : all term activation values for the primary input variable
    fired_rules : list of all evaluated rules (fired and not fired)
    narrative   : human-readable linguistic summary
    inputs      : raw numeric inputs used (for full audit trail)
    """
    name: str
    label: str
    activation: float
    activations: list[dict[str, Any]]   # primary variable activations
    fired_rules: list[dict[str, Any]]
    narrative: str
    inputs: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "activation": self.activation,
            "activations": self.activations,
            "fired_rules": self.fired_rules,
            "narrative": self.narrative,
            "inputs": self.inputs,
        }


@dataclass(frozen=True)
class FuzzyExplainabilityReport:
    """
    Complete Mamdani Fuzzy Inference output for a single symbol snapshot.

    Contains all 4 FIS dimensions plus a composite overall label.
    Every number in this report is fully traceable back to a deterministic
    analytics DTO — no black boxes, no historical training data.
    """
    symbol: str
    timestamp: str           # candle date of the most recent bar used
    current_price: float
    dimensions: list[FuzzyDimension]
    overall_label: str       # composite across 4 dimensions
    overall_activation: float
    methodology_note: str
    computed_at: str         # ISO timestamp of this inference run
    computation_ms: float    # time taken for inference (diagnostic)

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "current_price": self.current_price,
            "dimensions": [d.to_dict() for d in self.dimensions],
            "overall_label": self.overall_label,
            "overall_activation": self.overall_activation,
            "methodology_note": self.methodology_note,
            "computed_at": self.computed_at,
            "computation_ms": self.computation_ms,
        }


# ---------------------------------------------------------------------------
# FuzzyOrchestrator
# ---------------------------------------------------------------------------

class FuzzyOrchestrator:
    """
    Unified Mamdani Fuzzy Inference System entry point.

    Composes all 4 FIS dimensions into a single FuzzyExplainabilityReport.
    Thread-safe: stateless, pure computation.
    """

    def __init__(self, orchestrator: AnalyticsOrchestrator | None = None) -> None:
        self._analytics = orchestrator or default_orchestrator

    def explain(
        self,
        candles: list[dict[str, Any]],
        symbol: str,
    ) -> FuzzyExplainabilityReport:
        """
        Run the full Mamdani FIS pipeline for the given candles and symbol.

        Parameters
        ----------
        candles : list of OHLCV dicts (must have 'open','high','low','close','volume','time')
        symbol  : NSE symbol string (e.g., "RELIANCE.NS")

        Returns
        -------
        FuzzyExplainabilityReport — fully auditable linguistic interpretation
        """
        t_start = time.perf_counter()

        if not candles or len(candles) < 20:
            return self._empty_report(symbol, candles)

        # ── Step 1: Run full analytics pipeline ──────────────────────────
        summary = self._analytics.run_market_structure_summary(candles, symbol)
        ma = summary.moving_averages
        vol = summary.volume
        alignment = summary.signal_alignment
        regime = summary.market_regime
        sr = summary.support_resistance

        current_price = float(candles[-1]["close"]) if candles else 0.0
        last_timestamp = str(candles[-1].get("time", ""))

        # ── Step 2: Compute EMA values for Momentum FIS ──────────────────
        ema9_val = ma.ema_9 if ma else None
        ema20_val = ma.ema_20 if ma else None
        sma200_val = ma.sma_200 if ma else None

        # ── Step 3: Compute volume trend ─────────────────────────────────
        # Take last 5 sessions' volumes (excluding today) for trend baseline
        recent_vols = [float(c.get("volume", 0.0)) for c in candles[-6:-1]]
        today_vol = float(candles[-1].get("volume", 0.0))

        # ── Step 4: Evaluate MomentumFIS ─────────────────────────────────
        momentum_inputs = MomentumFIS.extract_inputs(current_price, ema9_val, ema20_val)
        momentum_result = MomentumFIS.evaluate(momentum_inputs)

        # ── Step 5: Evaluate VolumeFIS ────────────────────────────────────
        rvol_val = float(getattr(vol, "rvol", 1.0)) if vol and hasattr(vol, "rvol") else 1.0
        volume_inputs = VolumeFIS.extract_inputs(rvol_val, today_vol, recent_vols)
        volume_result = VolumeFIS.evaluate(volume_inputs)

        # ── Step 6: Evaluate TrendFIS ─────────────────────────────────────
        bullish_count = int(getattr(alignment, "bullish_alignment_count", 0))
        bearish_count = int(getattr(alignment, "bearish_alignment_count", 0))
        total_conditions = int(getattr(alignment, "alignment_total", max(1, bullish_count + bearish_count)))

        trend_inputs = TrendFIS.extract_inputs(
            current_price=current_price,
            sma200=sma200_val,
            bullish_count=bullish_count,
            bearish_count=bearish_count,
            total_conditions=total_conditions,
        )
        trend_result = TrendFIS.evaluate(trend_inputs)

        # ── Step 7: Evaluate StructureFIS ─────────────────────────────────
        regime_label = str(getattr(regime, "regime", "MIXED"))
        sr_zones_raw = []
        if sr and hasattr(sr, "zones"):
            sr_zones_raw = [
                {"zone_high": float(z.zone_high), "zone_low": float(z.zone_low)}
                for z in sr.zones
                if hasattr(z, "zone_high") and hasattr(z, "zone_low")
            ]

        structure_inputs = StructureFIS.extract_inputs(
            current_price=current_price,
            sr_zones=sr_zones_raw,
            regime=regime_label,
        )
        structure_result = StructureFIS.evaluate(structure_inputs, regime_label=regime_label)

        # ── Step 8: Compose dimensions ────────────────────────────────────
        dimensions: list[FuzzyDimension] = [
            FuzzyDimension(
                name="momentum",
                label=momentum_result.label,
                activation=momentum_result.activation,
                activations=momentum_result.ema_spread_activations,
                fired_rules=momentum_result.fired_rules,
                narrative=momentum_result.narrative,
                inputs=momentum_result.inputs,
            ),
            FuzzyDimension(
                name="volume",
                label=volume_result.label,
                activation=volume_result.activation,
                activations=volume_result.rvol_activations,
                fired_rules=volume_result.fired_rules,
                narrative=volume_result.narrative,
                inputs=volume_result.inputs,
            ),
            FuzzyDimension(
                name="trend",
                label=trend_result.label,
                activation=trend_result.activation,
                activations=trend_result.price_vs_sma200_activations,
                fired_rules=trend_result.fired_rules,
                narrative=trend_result.narrative,
                inputs=trend_result.inputs,
            ),
            FuzzyDimension(
                name="structure",
                label=structure_result.label,
                activation=structure_result.activation,
                activations=structure_result.zone_proximity_activations,
                fired_rules=structure_result.fired_rules,
                narrative=structure_result.narrative,
                inputs=structure_result.inputs,
            ),
        ]

        # ── Step 9: Compute overall composite ────────────────────────────
        weighted_score = sum(
            d.activation * DIMENSION_WEIGHTS.get(d.name, 0.25)
            for d in dimensions
        )
        overall_label = _composite_label(weighted_score)

        elapsed_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

        return FuzzyExplainabilityReport(
            symbol=symbol,
            timestamp=last_timestamp,
            current_price=round(current_price, 2),
            dimensions=dimensions,
            overall_label=overall_label,
            overall_activation=round(weighted_score, 4),
            methodology_note=(
                "Classical Mamdani Fuzzy Inference System. "
                "Linguistic interpretation layer only — no price prediction, "
                "no buy/sell signals, no machine learning. "
                "All activations derived deterministically from mathematical "
                "membership functions applied to analytics pipeline outputs."
            ),
            computed_at=datetime.now(timezone.utc).isoformat(),
            computation_ms=elapsed_ms,
        )

    def _empty_report(
        self,
        symbol: str,
        candles: list[dict[str, Any]],
    ) -> FuzzyExplainabilityReport:
        """Return a safe empty report when insufficient data is available."""
        price = float(candles[-1]["close"]) if candles else 0.0
        timestamp = str(candles[-1].get("time", "")) if candles else ""
        return FuzzyExplainabilityReport(
            symbol=symbol,
            timestamp=timestamp,
            current_price=price,
            dimensions=[],
            overall_label="INSUFFICIENT_DATA",
            overall_activation=0.0,
            methodology_note=(
                "Insufficient candle history for Mamdani FIS evaluation. "
                "Minimum 20 bars required."
            ),
            computed_at=datetime.now(timezone.utc).isoformat(),
            computation_ms=0.0,
        )


# Global singleton
default_fuzzy_orchestrator = FuzzyOrchestrator()
