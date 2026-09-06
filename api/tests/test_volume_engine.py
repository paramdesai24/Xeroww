"""
tests/test_volume_engine.py
───────────────────────────
Deterministic unit tests for the Volume Analytics and RVOL Engine.
"""

import pytest
from api.services.volume_service import analyze_volume


def _make_bar(o=100.0, h=105.0, l=95.0, c=102.0, v=1000.0):
    return {"time": "2026-01-01", "open": o, "high": h, "low": l, "close": c, "volume": v}


class TestVolumeCalculations:
    def test_rvol_and_spike_detection(self):
        # 20 bars of volume 1,000, latest bar volume 2,500 -> RVOL = 2.5, spike = True
        candles = [_make_bar(v=1000.0) for _ in range(20)]
        candles.append(_make_bar(v=2500.0))

        v = analyze_volume(candles, symbol="TEST.NS", baseline_window=20)
        assert v.current_volume == 2500.0
        assert v.baseline_avg_volume == 1000.0
        assert v.baseline_median_volume == 1000.0
        assert v.rvol == 2.5
        assert v.is_volume_spike is True
        assert v.volume_state == "ELEVATED"
        assert v.volume_deviation_pct == 150.0

    def test_unusually_low_volume(self):
        # 20 bars of 1,000, latest bar volume 400 -> RVOL = 0.4, state = UNUSUALLY_LOW
        candles = [_make_bar(v=1000.0) for _ in range(20)]
        candles.append(_make_bar(v=400.0))

        v = analyze_volume(candles, symbol="TEST.NS", baseline_window=20)
        assert v.rvol == 0.4
        assert v.volume_state == "UNUSUALLY_LOW"
        assert v.is_volume_spike is False

    def test_accumulation_and_distribution(self):
        # Price up + high volume -> ACCUMULATION
        up_candles = [_make_bar(v=1000.0) for _ in range(10)]
        up_candles.append(_make_bar(o=100.0, c=110.0, v=1800.0))
        res_up = analyze_volume(up_candles, symbol="TEST")
        assert res_up.price_volume_relationship == "ACCUMULATION"

        # Price down + high volume -> DISTRIBUTION
        down_candles = [_make_bar(v=1000.0) for _ in range(10)]
        down_candles.append(_make_bar(o=110.0, c=100.0, v=1800.0))
        res_down = analyze_volume(down_candles, symbol="TEST")
        assert res_down.price_volume_relationship == "DISTRIBUTION"

    def test_breakout_confirmed(self):
        # 10 bars trading below 110, latest closes at 120 with high volume
        candles = [_make_bar(o=100, h=108, l=98, c=105, v=1000) for _ in range(10)]
        candles.append(_make_bar(o=106, h=121, l=105, c=120, v=1600))
        res = analyze_volume(candles, symbol="TEST")
        assert res.breakout_confirmed is True

    def test_empty_and_zero_volume(self):
        empty_res = analyze_volume([], symbol="EMPTY")
        assert empty_res.current_volume == 0.0
        assert empty_res.rvol == 1.0

        zero_res = analyze_volume([_make_bar(v=0.0)], symbol="ZERO")
        assert zero_res.current_volume == 0.0
        assert zero_res.rvol == 1.0
