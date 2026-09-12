"""
api/tests/test_fuzzy_orchestrator.py
───────────────────────────────────
Unit tests for the Mamdani Fuzzy Explainability Engine:
- Directional polarity synthesis (bearish indicators produce bearish composite)
- SR zones extraction and StructureFIS integration
- Insufficient data handling
- Rule defuzzification resilience
"""

from __future__ import annotations

from api.fuzzy.orchestrator import default_fuzzy_orchestrator
from api.fuzzy.dimensions.structure import StructureFIS, StructureInputs


def _generate_downtrend_candles(n: int = 220) -> list[dict]:
    """Generate deterministic declining candle sequence with positive prices."""
    base = 3000.0
    candles = []
    for i in range(n):
        price = base - (i * 5.0)
        candles.append({
            "time": f"2026-01-{i+1:02d}",
            "open": price + 5.0,
            "high": price + 7.0,
            "low": price - 6.0,
            "close": price,
            "volume": 50000.0 + (i * 100.0),
        })
    return candles


def _generate_uptrend_candles(n: int = 220) -> list[dict]:
    """Generate deterministic rising candle sequence."""
    base = 1000.0
    candles = []
    for i in range(n):
        price = base + (i * 5.0)
        candles.append({
            "time": f"2026-01-{i+1:02d}",
            "open": price - 5.0,
            "high": price + 8.0,
            "low": price - 4.0,
            "close": price,
            "volume": 80000.0 + (i * 500.0),
        })
    return candles


class TestFuzzyOrchestrator:
    def test_downtrend_yields_bearish_overall_label(self):
        """Verifies that a stock in a clear downtrend produces a BEARISH overall label, not BULLISH."""
        candles = _generate_downtrend_candles(220)
        report = default_fuzzy_orchestrator.explain(candles, "TEST_BEAR.NS")

        assert report.symbol == "TEST_BEAR.NS"
        assert report.overall_label in ("MODERATELY_BEARISH", "STRONGLY_BEARISH")
        assert report.overall_activation > 0.40

        dim_map = {d.name: d for d in report.dimensions}
        assert dim_map["trend"].label == "BEARISH"
        assert dim_map["momentum"].label == "WEAK"

    def test_uptrend_yields_bullish_overall_label(self):
        """Verifies that a stock in a clear uptrend produces a BULLISH overall label."""
        candles = _generate_uptrend_candles(220)
        report = default_fuzzy_orchestrator.explain(candles, "TEST_BULL.NS")

        assert report.symbol == "TEST_BULL.NS"
        assert report.overall_label in ("MODERATELY_BULLISH", "STRONGLY_BULLISH")
        assert report.overall_activation > 0.30

        dim_map = {d.name: d for d in report.dimensions}
        assert dim_map["trend"].label in ("BULLISH", "STRONGLY_BULLISH")
        assert dim_map["momentum"].label in ("STRONG", "SURGING")

    def test_insufficient_candles_returns_empty_report(self):
        """Under 20 bars must return INSUFFICIENT_DATA."""
        short_candles = _generate_downtrend_candles(10)
        report = default_fuzzy_orchestrator.explain(short_candles, "SHORT.NS")

        assert report.overall_label == "INSUFFICIENT_DATA"
        assert len(report.dimensions) == 0

    def test_structure_fis_evaluates_with_weak_regime(self):
        """Verifies StructureFIS does not return UNKNOWN when price is near zone in weak regime."""
        inputs = StructureInputs(zone_proximity_pct=0.5, regime_strength=0.15)
        result = StructureFIS.evaluate(inputs, regime_label="TRENDING_DOWN")

        assert result.label in ("CONTESTED", "BROKEN")
        assert result.activation > 0.0
