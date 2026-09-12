"""
tests/test_analytics_services.py
────────────────────────────────
Unit tests for isolated calculation services in api.analytics:
  - EMAService
  - SMAService
  - VolumeService
  - RVOLService
  - PatternService
  - StructureService
  - SupportResistanceService
"""

import pytest
from api.analytics.ema import EMAService, EMAResult
from api.analytics.sma import SMAService, SMAResult
from api.analytics.volume import VolumeService, VolumeDTO
from api.analytics.rvol import RVOLService, RVOLDTO
from api.analytics.pattern import PatternService, CandleSummaryDTO, MarubozuResultDTO
from api.analytics.structure import StructureService, MarketRegimeDTO, SignalAlignmentDTO
from api.analytics.support import SupportResistanceService, SRAnalysisDTO


@pytest.fixture
def sample_candles():
    """Generates 30 synthetic OHLCV candles with upward trend and volume spike at end."""
    candles = []
    base_price = 100.0
    for i in range(30):
        o = base_price + i * 2.0
        h = o + 3.0
        l = o - 1.0  # noqa: E741
        c = o + 2.0
        vol = 10000.0 if i < 29 else 25000.0  # Spike on final bar
        day = f"2025-01-{i+1:02d}"
        candles.append({
            "time": day,
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": vol,
        })
    return candles


# ---------------------------------------------------------------------------
# 1. EMAService Tests
# ---------------------------------------------------------------------------
class TestEMAService:
    def test_ema_empty_series(self):
        result = EMAService.calculate_series([], 9)
        assert result == []

    def test_ema_insufficient_bars(self):
        result = EMAService.calculate_series([10.0, 11.0], 9)
        assert len(result) == 2
        assert all(v is None for v in result)

    def test_ema_compute_dto(self):
        closes = [float(100 + i) for i in range(25)]
        dto = EMAService.compute(closes, 9)
        assert isinstance(dto, EMAResult)
        assert dto.period == 9
        assert dto.current is not None
        assert len(dto.series) == 25
        assert dto.series[0] is None
        assert dto.series[8] is not None
        d = dto.to_dict()
        assert d["period"] == 9
        assert "current" in d

    def test_ema_evaluate_position(self):
        assert EMAService.evaluate_position(100.0, None) == "UNAVAILABLE"
        assert EMAService.evaluate_position(100.0, 100.0) == "AT"
        assert EMAService.evaluate_position(105.0, 100.0) == "ABOVE"
        assert EMAService.evaluate_position(95.0, 100.0) == "BELOW"

    def test_ema_crossover(self):
        fast = [10.0, 12.0]
        slow = [11.0, 11.5]
        cross = EMAService.evaluate_crossover(fast, slow, 9, 20)
        assert cross.relationship == "BULLISH_CROSSOVER"


# ---------------------------------------------------------------------------
# 2. SMAService Tests
# ---------------------------------------------------------------------------
class TestSMAService:
    def test_sma_series_calculation(self):
        closes = [10.0, 20.0, 30.0, 40.0, 50.0]
        sma3 = SMAService.calculate_series(closes, 3)
        assert sma3[0] is None
        assert sma3[1] is None
        assert sma3[2] == 20.0  # (10+20+30)/3
        assert sma3[3] == 30.0  # (20+30+40)/3
        assert sma3[4] == 40.0  # (30+40+50)/3

    def test_sma_compute_dto(self):
        closes = [float(i) for i in range(25)]
        dto = SMAService.compute(closes, 20)
        assert isinstance(dto, SMAResult)
        assert dto.period == 20
        assert dto.current is not None
        assert len(dto.series) == 25

    def test_sma_evaluate_position(self):
        assert SMAService.evaluate_position(200.0, 190.0) == "ABOVE"
        assert SMAService.evaluate_position(180.0, 190.0) == "BELOW"


# ---------------------------------------------------------------------------
# 3. VolumeService Tests
# ---------------------------------------------------------------------------
class TestVolumeService:
    def test_volume_empty(self):
        dto = VolumeService.analyze([], "TEST.NS")
        assert isinstance(dto, VolumeDTO)
        assert dto.symbol == "TEST.NS"
        assert dto.rvol == 1.0
        assert dto.volume_state == "NORMAL"

    def test_volume_spike_detection(self, sample_candles):
        dto = VolumeService.analyze(sample_candles, "RELIANCE.NS")
        assert isinstance(dto, VolumeDTO)
        assert dto.current_volume == 25000.0
        assert dto.rvol >= 2.0
        assert dto.is_volume_spike is True
        assert dto.volume_state == "ELEVATED"
        assert dto.price_volume_relationship in ["ACCUMULATION", "DISTRIBUTION", "NEUTRAL"]
        d = dto.to_dict()
        assert "rvol" in d


# ---------------------------------------------------------------------------
# 4. RVOLService Tests
# ---------------------------------------------------------------------------
class TestRVOLService:
    def test_rvol_classification(self):
        assert RVOLService.classify_state(2.5) == "ELEVATED"
        assert RVOLService.classify_state(1.0) == "NORMAL"
        assert RVOLService.classify_state(0.4) == "UNUSUALLY_LOW"

    def test_rvol_compute(self):
        dto = RVOLService.compute(current_volume=3000.0, baseline_volumes=[1000.0, 1000.0, 1000.0])
        assert isinstance(dto, RVOLDTO)
        assert dto.rvol == 3.0
        assert dto.is_spike is True
        assert dto.state == "ELEVATED"

    def test_rvol_from_candles(self, sample_candles):
        dto = RVOLService.compute_from_candles(sample_candles)
        assert isinstance(dto, RVOLDTO)
        assert dto.is_spike is True


# ---------------------------------------------------------------------------
# 5. PatternService Tests
# ---------------------------------------------------------------------------
class TestPatternService:
    def test_analyse_single_candle(self):
        c = {"time": "2025-01-01", "open": 100.0, "high": 110.0, "low": 95.0, "close": 108.0, "volume": 5000}
        dto = PatternService.analyse_candle(c)
        assert isinstance(dto, CandleSummaryDTO)
        assert dto.direction == "bullish"
        assert dto.range_pct > 0
        assert dto.body_pct > 0

    def test_marubozu_detection(self, sample_candles):
        dto = PatternService.detect_marubozu(sample_candles, "TCS.NS", "Tata Consultancy Services")
        assert isinstance(dto, MarubozuResultDTO)
        assert dto.symbol == "TCS.NS"
        assert "latest_candle" in dto.to_dict()


# ---------------------------------------------------------------------------
# 6. StructureService Tests
# ---------------------------------------------------------------------------
class TestStructureService:
    def test_classify_regime(self, sample_candles):
        dto = StructureService.classify_regime(sample_candles, "INFY.NS")
        assert isinstance(dto, MarketRegimeDTO)
        assert dto.symbol == "INFY.NS"
        assert dto.regime in [
            "TRENDING_UP", "TRENDING_DOWN", "RANGE_BOUND",
            "HIGH_VOLATILITY", "LOW_ACTIVITY", "MIXED"
        ]
        assert isinstance(dto.reasons, list)

    def test_evaluate_alignment(self, sample_candles):
        dto = StructureService.evaluate_alignment(sample_candles, "INFY.NS")
        assert isinstance(dto, SignalAlignmentDTO)
        assert dto.alignment_total > 0
        assert dto.dominant_bias in ["BULLISH_CONFLUENCE", "BEARISH_CONFLUENCE", "NEUTRAL_MIXED"]


# ---------------------------------------------------------------------------
# 7. SupportResistanceService Tests
# ---------------------------------------------------------------------------
class TestSupportResistanceService:
    def test_sr_analysis(self, sample_candles):
        dto = SupportResistanceService.analyze(sample_candles, "HDFCBANK.NS")
        assert isinstance(dto, SRAnalysisDTO)
        assert dto.symbol == "HDFCBANK.NS"
        assert dto.current_price > 0
        assert isinstance(dto.support_zones, list)
        assert isinstance(dto.resistance_zones, list)
        d = dto.to_dict()
        assert "current_price" in d
