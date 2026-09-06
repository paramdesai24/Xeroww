"""
tests/test_support_resistance.py
────────────────────────────────
Deterministic unit tests for Support and Resistance Zone Engine.
Verifies swing point detection, zone clustering, touch counting, and nearest level classification.
"""

import pytest
from api.services.support_resistance_service import (
    find_swing_points,
    cluster_swing_points,
    analyze_support_resistance,
    compute_atr,
    SwingPoint,
)


def _make_candle(time="2026-01-01", o=100.0, h=105.0, l=95.0, c=100.0, v=1000.0):
    return {"time": time, "open": o, "high": h, "low": l, "close": c, "volume": v}


class TestSwingPointDetection:
    def test_detects_clear_peak_and_trough(self):
        # Create 11 candles with a clear peak at index 4 (high=150) and trough at index 7 (low=80)
        candles = []
        for i in range(11):
            candles.append(_make_candle(time=f"2026-01-{i+1:02d}", o=100, h=105, l=95, c=100))

        # Inject peak at index 4
        candles[4]["high"] = 150.0
        # Inject trough at index 7
        candles[7]["low"] = 70.0

        swings = find_swing_points(candles, left_bars=2, right_bars=2)
        swing_highs = [s for s in swings if s.point_type == "high"]
        swing_lows = [s for s in swings if s.point_type == "low"]

        assert any(s.index == 4 and s.price == 150.0 for s in swing_highs)
        assert any(s.index == 7 and s.price == 70.0 for s in swing_lows)


class TestClustering:
    def test_clusters_nearby_swings_into_single_zone(self):
        # 3 swing points near 100, 2 swing points near 150
        swings = [
            SwingPoint(index=2, time="d2", price=99.5, point_type="low"),
            SwingPoint(index=5, time="d5", price=100.2, point_type="low"),
            SwingPoint(index=9, time="d9", price=100.8, point_type="low"),
            SwingPoint(index=14, time="d14", price=149.5, point_type="high"),
            SwingPoint(index=18, time="d18", price=150.5, point_type="high"),
        ]

        # Current price = 125, tolerance = 2.0
        zones = cluster_swing_points(swings, current_price=125.0, tolerance=2.0, total_candles=20)
        assert len(zones) == 2

        zone_100 = next(z for z in zones if 99.0 <= z.price <= 101.0)
        assert zone_100.touches == 3
        assert zone_100.level_type == "support"
        assert zone_100.zone_low == 99.5
        assert zone_100.zone_high == 100.8

        zone_150 = next(z for z in zones if 149.0 <= z.price <= 151.0)
        assert zone_150.touches == 2
        assert zone_150.level_type == "resistance"


class TestSupportVsResistanceAnalysis:
    def test_full_analysis_identifies_nearest_levels(self):
        # Build a 25-candle wave oscillating between support 100 and resistance 130
        candles = []
        prices = [
            110, 115, 120, 125, 130, 125, 120, 115, 100, 105, 110, 120, 130, 125, 115, 100, 105, 115, 120, 118
        ]
        for i, p in enumerate(prices):
            candles.append(_make_candle(
                time=f"2026-01-{i+1:02d}",
                o=p,
                h=p + 2,
                l=p - 2,
                c=p,
            ))

        analysis = analyze_support_resistance(candles, symbol="TEST.NS", left_bars=2, right_bars=2)
        assert analysis.symbol == "TEST.NS"
        assert analysis.current_price == 118.0
        assert analysis.nearest_support is not None
        assert analysis.nearest_resistance is not None
        # Nearest support must be <= current_price
        assert analysis.nearest_support.price <= 118.0
        # Nearest resistance must be >= current_price
        assert analysis.nearest_resistance.price >= 118.0


class TestEdgeCases:
    def test_empty_candles(self):
        res = analyze_support_resistance([], symbol="EMPTY")
        assert res.current_price == 0.0
        assert res.nearest_support is None
        assert res.nearest_resistance is None
        assert res.support_zones == []

    def test_insufficient_candles_for_lookaround(self):
        # Only 3 candles with left_bars=3, right_bars=3 -> no interior index
        candles = [_make_candle() for _ in range(3)]
        res = analyze_support_resistance(candles, symbol="FEW", left_bars=3, right_bars=3)
        assert res.total_swings_detected == 0
        assert res.nearest_support is None

    def test_atr_calculation_monotonic(self):
        candles = [
            _make_candle(o=100, h=105, l=95, c=100),
            _make_candle(o=100, h=110, l=95, c=105),
            _make_candle(o=105, h=115, l=100, c=110),
        ]
        atr = compute_atr(candles, period=14)
        assert atr > 0.0
