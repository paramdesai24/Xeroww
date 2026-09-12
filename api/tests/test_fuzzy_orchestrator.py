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

from api.fuzzy.dimensions.structure import StructureFIS, StructureInputs
from api.fuzzy.orchestrator import default_fuzzy_orchestrator


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

    def test_structure_fis_at_zone_zero_proximity_never_unknown(self):
        """Verifies StructureFIS at zone boundary 0.0% (like TCS/ICICI) evaluates to valid state."""
        inputs_tcs = StructureInputs(zone_proximity_pct=0.0, regime_strength=0.975)
        res_tcs = StructureFIS.evaluate(inputs_tcs, regime_label="TRENDING_UP")
        assert res_tcs.label in ("DOMINANT", "FIRM")
        assert res_tcs.activation > 0.0
        assert res_tcs.label != "UNKNOWN"

        inputs_icici = StructureInputs(zone_proximity_pct=0.0, regime_strength=0.453)
        res_icici = StructureFIS.evaluate(inputs_icici, regime_label="MIXED")
        assert res_icici.label in ("FIRM", "CONTESTED")
        assert res_icici.activation > 0.0
        assert res_icici.label != "UNKNOWN"

    def test_structure_fis_no_nearby_zones_classifies_as_contested_with_low_activation(self):
        """If no zone exists nearby, classify as CONTESTED with very low activation instead of UNKNOWN."""
        # Explicit flag
        inputs = StructureInputs(zone_proximity_pct=99.0, regime_strength=0.5, no_zone_nearby=True)
        res = StructureFIS.evaluate(inputs, regime_label="RANGE_BOUND")
        assert res.label == "CONTESTED"
        assert res.activation == 0.05
        assert "No SR zones exist nearby" in res.narrative

        # Derived via extract_inputs with empty zones
        extracted = StructureFIS.extract_inputs(
            current_price=2500.0,
            sr_zones=[],
            regime="RANGE_BOUND",
        )
        assert extracted.no_zone_nearby is True
        res_extracted = StructureFIS.evaluate(extracted, regime_label="RANGE_BOUND")
        assert res_extracted.label == "CONTESTED"
        assert res_extracted.activation == 0.05

    def test_structure_fis_universe_is_always_complete(self):
        """The fuzzy universe must be complete: strictly emit DOMINANT, FIRM, CONTESTED, or BROKEN."""
        valid_labels = {"DOMINANT", "FIRM", "CONTESTED", "BROKEN"}
        for prox in [0.0, 0.1, 0.5, 1.0, 2.5, 4.0, 6.0, 10.0, 25.0, 99.0]:
            for reg in [0.0, 0.15, 0.35, 0.5, 0.75, 0.85, 1.0]:
                for no_zone in (False, True):
                    inp = StructureInputs(zone_proximity_pct=prox, regime_strength=reg, no_zone_nearby=no_zone)
                    res = StructureFIS.evaluate(inp)
                    assert res.label in valid_labels, f"Got invalid label {res.label} for prox={prox}, reg={reg}"
                    assert res.label != "UNKNOWN"
                    assert res.activation > 0.0

