"""
tests/test_analytics_orchestrator.py
────────────────────────────────────
Unit and integration tests for AnalyticsOrchestrator composition and DTO serialization.
Verifies the drop-in boundary seam for Kafka/Spark streaming.
"""

import pytest
from api.analytics import (
    AnalyticsOrchestrator,
    MovingAveragesSnapshotDTO,
    MarketStructureSummaryDTO,
    default_orchestrator,
)
from api.schemas.market_structure import MarketStructureSummaryResponse


@pytest.fixture
def synthetic_candles():
    """Generates 50 realistic historical OHLCV daily bars."""
    candles = []
    base_price = 1000.0
    for i in range(50):
        o = base_price + i * 5.0
        h = o + 10.0
        l = o - 4.0  # noqa: E741
        c = o + 6.0
        vol = 50000.0 + (i * 1000.0)
        candles.append({
            "time": f"2025-01-{(i % 28) + 1:02d}",
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": vol,
        })
    return candles


class TestAnalyticsOrchestrator:
    def test_default_orchestrator_instance(self):
        assert isinstance(default_orchestrator, AnalyticsOrchestrator)

    def test_run_moving_averages_composition(self, synthetic_candles):
        orchestrator = AnalyticsOrchestrator()
        result = orchestrator.run_moving_averages(synthetic_candles, "RELIANCE.NS")
        assert isinstance(result, MovingAveragesSnapshotDTO)
        assert result.symbol == "RELIANCE.NS"
        assert result.current_price > 0
        assert result.sma_20 is not None
        assert result.ema_9 is not None
        assert len(result.series) == 50
        assert result.price_vs_sma20 in ["ABOVE", "BELOW", "AT", "UNAVAILABLE"]
        d = result.to_dict()
        assert "structural_summary" in d
        assert "series" in d

    def test_run_volume_and_rvol(self, synthetic_candles):
        orchestrator = AnalyticsOrchestrator()
        vol = orchestrator.run_volume(synthetic_candles, "TCS.NS")
        assert vol.symbol == "TCS.NS"
        assert vol.rvol > 0

        rvol_dto = orchestrator.run_rvol(synthetic_candles)
        assert rvol_dto.rvol > 0
        assert rvol_dto.state in ["ELEVATED", "NORMAL", "UNUSUALLY_LOW"]

    def test_run_support_resistance(self, synthetic_candles):
        orchestrator = AnalyticsOrchestrator()
        sr = orchestrator.run_support_resistance(synthetic_candles, "INFY.NS")
        assert sr.symbol == "INFY.NS"
        assert sr.current_price > 0
        assert isinstance(sr.support_zones, list)

    def test_run_structure_regime_and_alignment(self, synthetic_candles):
        orchestrator = AnalyticsOrchestrator()
        regime = orchestrator.run_market_regime(synthetic_candles, "HDFCBANK.NS")
        assert regime.regime is not None

        alignment = orchestrator.run_signal_alignment(synthetic_candles, "HDFCBANK.NS")
        assert alignment.alignment_total > 0

        structure = orchestrator.run_structure(synthetic_candles, "HDFCBANK.NS")
        assert structure.symbol == "HDFCBANK.NS"
        assert "regime" in structure.to_dict()
        assert "alignment" in structure.to_dict()

    def test_run_patterns_and_marubozu(self, synthetic_candles):
        orchestrator = AnalyticsOrchestrator()
        patterns = orchestrator.run_patterns(synthetic_candles, lookback=5)
        assert isinstance(patterns, list)

        marubozu = orchestrator.run_marubozu(synthetic_candles, "RELIANCE.NS", "Reliance Industries")
        assert marubozu.symbol == "RELIANCE.NS"

    def test_run_market_structure_summary_pydantic_compatibility(self, synthetic_candles):
        """
        Verify that MarketStructureSummaryDTO output is 100% schema-compatible with
        FastAPI MarketStructureSummaryResponse schema.
        """
        orchestrator = AnalyticsOrchestrator()
        dto = orchestrator.run_market_structure_summary(synthetic_candles, "RELIANCE.NS")
        assert isinstance(dto, MarketStructureSummaryDTO)

        # Ensure dictionary output can directly instantiate MarketStructureSummaryResponse
        dict_output = dto.to_dict()
        pydantic_obj = MarketStructureSummaryResponse(**dict_output)
        assert pydantic_obj.symbol == "RELIANCE.NS"
        assert pydantic_obj.current_price == dto.current_price
        assert pydantic_obj.volume.rvol == dto.volume.rvol
        assert pydantic_obj.moving_averages.current_price == dto.moving_averages.current_price

    def test_replay_and_events_orchestration(self, synthetic_candles):
        orchestrator = AnalyticsOrchestrator()
        timeline = orchestrator.run_replay_timeline("RELIANCE.NS", synthetic_candles)
        assert timeline["symbol"] == "RELIANCE.NS"
        assert timeline["total_bars"] == 50

        step_res = orchestrator.run_replay_step("RELIANCE.NS", synthetic_candles, 10)
        assert "current_candle" in step_res
        assert "moving_averages" in step_res

        events = orchestrator.run_events_timeline("RELIANCE.NS", synthetic_candles)
        assert isinstance(events, list)
