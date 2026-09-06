"""
tests/test_moving_averages.py
─────────────────────────────
Deterministic unit tests for Moving Average Engine: SMA(20,50,200) and EMA(9,20).
Validates mathematical correctness against hand-calculated references and crossover logic.
"""

import pytest
from api.services.moving_average_service import (
    calculate_sma_series,
    calculate_ema_series,
    evaluate_position,
    evaluate_crossover,
    analyze_moving_averages,
)


class TestMathematicalCorrectness:
    def test_sma_reference_values(self):
        # 5 bars: 10, 20, 30, 40, 50
        # SMA(3) should be:
        # bar 0,1: None
        # bar 2: (10+20+30)/3 = 20.0
        # bar 3: (20+30+40)/3 = 30.0
        # bar 4: (30+40+50)/3 = 40.0
        closes = [10.0, 20.0, 30.0, 40.0, 50.0]
        sma = calculate_sma_series(closes, period=3)
        assert sma[0] is None
        assert sma[1] is None
        assert sma[2] == 20.0
        assert sma[3] == 30.0
        assert sma[4] == 40.0

    def test_ema_reference_values(self):
        # 4 bars: 10, 20, 30, 40 with period=3
        # alpha = 2 / (3 + 1) = 0.5
        # seed = SMA(3) at index 2 = (10+20+30)/3 = 20.0
        # index 3: alpha * 40 + (1 - alpha) * 20 = 0.5 * 40 + 0.5 * 20 = 30.0
        closes = [10.0, 20.0, 30.0, 40.0]
        ema = calculate_ema_series(closes, period=3)
        assert ema[0] is None
        assert ema[1] is None
        assert ema[2] == 20.0
        assert ema[3] == 30.0


class TestPositionAndCrossovers:
    def test_position_evaluation(self):
        assert evaluate_position(105.0, 100.0) == "ABOVE"
        assert evaluate_position(95.0, 100.0) == "BELOW"
        assert evaluate_position(100.05, 100.0) == "AT"
        assert evaluate_position(100.0, None) == "UNAVAILABLE"

    def test_crossover_events(self):
        # Bar 1: Fast (10) <= Slow (12)
        # Bar 2: Fast (14) > Slow (13) -> Crossover!
        fast = [None, 10.0, 14.0]
        slow = [None, 12.0, 13.0]
        cross = evaluate_crossover(fast, slow, "BULLISH_CROSSOVER", "BEARISH_CROSSOVER")
        assert cross == "BULLISH_CROSSOVER"


class TestFullAnalysisSnapshot:
    def test_handles_insufficient_data_gracefully(self):
        # 30 bars: sufficient for SMA20, EMA9, EMA20; insufficient for SMA50 and SMA200
        candles = [{"time": f"d{i}", "close": 100.0 + i} for i in range(30)]
        res = analyze_moving_averages(candles, symbol="INSUF.NS")
        assert res.sma_20 is not None
        assert res.ema_9 is not None
        assert res.ema_20 is not None
        assert res.sma_50 is None
        assert res.sma_200 is None
        assert res.price_vs_sma50 == "UNAVAILABLE"
        assert res.price_vs_sma200 == "UNAVAILABLE"
        assert res.price_vs_sma20 == "ABOVE"

    def test_empty_candles(self):
        res = analyze_moving_averages([], symbol="EMPTY")
        assert res.current_price == 0.0
        assert res.sma_20 is None
        assert res.series == []
