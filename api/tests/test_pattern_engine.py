"""
tests/test_pattern_engine.py
────────────────────────────
Deterministic unit tests for Candlestick Pattern Engine V2.
Uses synthetic known candles to verify exact mathematical pattern detection.
"""

from api.services.pattern_engine import (
    extract_metrics,
    detect_marubozu_candle,
    detect_doji_candle,
    detect_spinning_top_candle,
    detect_hammer_or_hanging_man,
    detect_engulfing,
    detect_harami,
    detect_star_patterns,
    detect_gaps,
    scan_patterns,
)


def _make_candle(time="2026-01-01", o=100.0, h=105.0, l=95.0, c=102.0, v=1000.0):
    return {"time": time, "open": o, "high": h, "low": l, "close": c, "volume": v}


class TestMarubozu:
    def test_bullish_marubozu_perfect(self):
        c = _make_candle(o=100.0, h=110.0, l=100.0, c=110.0)
        m = extract_metrics(c)
        d = detect_marubozu_candle(m)
        assert d is not None
        assert d.pattern == "Bullish Marubozu"
        assert d.direction == "bullish"
        assert d.category == "continuation"
        assert d.context["stop_loss"] == 100.0

    def test_bearish_marubozu_perfect(self):
        c = _make_candle(o=110.0, h=110.0, l=100.0, c=100.0)
        m = extract_metrics(c)
        d = detect_marubozu_candle(m)
        assert d is not None
        assert d.pattern == "Bearish Marubozu"
        assert d.direction == "bearish"
        assert d.context["stop_loss"] == 110.0

    def test_marubozu_rejected_due_to_long_wick(self):
        # 30% upper wick -> should NOT be a marubozu
        c = _make_candle(o=100.0, h=115.0, l=100.0, c=108.0)
        m = extract_metrics(c)
        d = detect_marubozu_candle(m)
        assert d is None


class TestDoji:
    def test_standard_doji(self):
        c = _make_candle(o=100.0, h=105.0, l=95.0, c=100.1)
        m = extract_metrics(c)
        d = detect_doji_candle(m)
        assert d is not None
        assert "Doji" in d.pattern
        assert d.direction == "neutral"

    def test_dragonfly_doji(self):
        # Upper wick tiny (100 to 100.2), lower wick large (90 to 100)
        c = _make_candle(o=100.0, h=100.2, l=90.0, c=100.0)
        m = extract_metrics(c)
        d = detect_doji_candle(m)
        assert d is not None
        assert d.pattern == "Dragonfly Doji"
        assert d.direction == "bullish"
        assert d.context["stop_loss"] == 90.0

    def test_gravestone_doji(self):
        # Lower wick tiny (100 to 99.8), upper wick large (100 to 110)
        c = _make_candle(o=100.0, h=110.0, l=99.8, c=100.0)
        m = extract_metrics(c)
        d = detect_doji_candle(m)
        assert d is not None
        assert d.pattern == "Gravestone Doji"
        assert d.direction == "bearish"
        assert d.context["stop_loss"] == 110.0

    def test_long_legged_doji(self):
        # High=115, Low=85, Open=Close=100
        c = _make_candle(o=100.0, h=115.0, l=85.0, c=100.2)
        m = extract_metrics(c)
        d = detect_doji_candle(m)
        assert d is not None
        assert d.pattern == "Long-Legged Doji"


class TestSpinningTop:
    def test_spinning_top_symmetric(self):
        # Range 80 to 120 (40 pts). Open=98, Close=102 (Body 4 pts = 10%). Shadows ~18 pts each
        c = _make_candle(o=98.0, h=120.0, l=80.0, c=102.0)
        m = extract_metrics(c)
        d = detect_spinning_top_candle(m)
        assert d is not None
        assert d.pattern == "Spinning Top"
        assert d.direction == "neutral"

    def test_spinning_top_rejected_for_large_body(self):
        # Body 30 pts in 40 pt range (75%) -> Not spinning top
        c = _make_candle(o=85.0, h=120.0, l=80.0, c=115.0)
        m = extract_metrics(c)
        assert detect_spinning_top_candle(m) is None


class TestHammerAndHangingMan:
    def test_hammer_in_downtrend(self):
        # Prior was bearish
        prior = extract_metrics(_make_candle(o=105.0, h=106.0, l=98.0, c=99.0))
        # Current: small body at top (98.5 to 100), low=88, high=100.5
        curr = extract_metrics(_make_candle(o=98.5, h=100.5, l=88.0, c=100.0))
        d = detect_hammer_or_hanging_man(curr, prior)
        assert d is not None
        assert d.pattern == "Hammer"
        assert d.direction == "bullish"
        assert d.context["stop_loss"] == 88.0

    def test_hanging_man_in_uptrend(self):
        # Prior was bullish
        prior = extract_metrics(_make_candle(o=90.0, h=101.0, l=89.0, c=100.0))
        # Current: hammer geometry at top of advance
        curr = extract_metrics(_make_candle(o=101.0, h=102.0, l=92.0, c=101.8))
        d = detect_hammer_or_hanging_man(curr, prior)
        assert d is not None
        assert d.pattern == "Hanging Man"
        assert d.direction == "bearish"
        assert d.context["stop_loss"] == 102.0


class TestEngulfing:
    def test_bullish_engulfing(self):
        prior = extract_metrics(_make_candle(o=100.0, h=101.0, l=94.0, c=95.0))
        curr = extract_metrics(_make_candle(o=94.0, h=104.0, l=93.0, c=102.0))
        d = detect_engulfing(curr, prior)
        assert d is not None
        assert d.pattern == "Bullish Engulfing"
        assert d.direction == "bullish"
        assert d.context["stop_loss"] == 93.0

    def test_bearish_engulfing(self):
        prior = extract_metrics(_make_candle(o=95.0, h=101.0, l=94.0, c=100.0))
        curr = extract_metrics(_make_candle(o=101.0, h=102.0, l=91.0, c=93.0))
        d = detect_engulfing(curr, prior)
        assert d is not None
        assert d.pattern == "Bearish Engulfing"
        assert d.direction == "bearish"
        assert d.context["stop_loss"] == 102.0


class TestHarami:
    def test_bullish_harami(self):
        prior = extract_metrics(_make_candle(o=110.0, h=111.0, l=89.0, c=90.0))
        curr = extract_metrics(_make_candle(o=94.0, h=99.0, l=93.0, c=97.0))
        d = detect_harami(curr, prior)
        assert d is not None
        assert d.pattern == "Bullish Harami"
        assert d.direction == "bullish"

    def test_bearish_harami(self):
        prior = extract_metrics(_make_candle(o=90.0, h=112.0, l=89.0, c=110.0))
        curr = extract_metrics(_make_candle(o=104.0, h=106.0, l=99.0, c=100.0))
        d = detect_harami(curr, prior)
        assert d is not None
        assert d.pattern == "Bearish Harami"
        assert d.direction == "bearish"


class TestStarPatterns:
    def test_morning_star(self):
        c1 = extract_metrics(_make_candle(time="d1", o=100.0, h=101.0, l=89.0, c=90.0))
        c2 = extract_metrics(_make_candle(time="d2", o=87.0, h=89.0, l=85.0, c=88.0))
        c3 = extract_metrics(_make_candle(time="d3", o=89.0, h=99.0, l=88.0, c=97.0))
        d = detect_star_patterns(c1, c2, c3)
        assert d is not None
        assert d.pattern == "Morning Star"
        assert d.direction == "bullish"
        assert d.context["stop_loss"] == 85.0

    def test_evening_star(self):
        c1 = extract_metrics(_make_candle(time="d1", o=90.0, h=101.0, l=89.0, c=100.0))
        c2 = extract_metrics(_make_candle(time="d2", o=102.0, h=104.0, l=101.0, c=102.5))
        c3 = extract_metrics(_make_candle(time="d3", o=101.0, h=102.0, l=92.0, c=93.0))
        d = detect_star_patterns(c1, c2, c3)
        assert d is not None
        assert d.pattern == "Evening Star"
        assert d.direction == "bearish"
        assert d.context["stop_loss"] == 104.0


class TestGaps:
    def test_gap_up(self):
        prior = extract_metrics(_make_candle(o=95.0, h=100.0, l=94.0, c=99.0))
        curr = extract_metrics(_make_candle(o=103.0, h=108.0, l=102.0, c=107.0))
        d = detect_gaps(curr, prior)
        assert d is not None
        assert d.pattern == "Gap Up"
        assert d.direction == "bullish"
        assert d.context["gap_size"] == 2.0

    def test_gap_down(self):
        prior = extract_metrics(_make_candle(o=105.0, h=108.0, l=100.0, c=101.0))
        curr = extract_metrics(_make_candle(o=97.0, h=98.0, l=90.0, c=92.0))
        d = detect_gaps(curr, prior)
        assert d is not None
        assert d.pattern == "Gap Down"
        assert d.direction == "bearish"
        assert d.context["gap_size"] == 2.0


class TestScannerAndEdgeCases:
    def test_empty_series(self):
        assert scan_patterns([]) == []

    def test_flat_candle_zero_range(self):
        c = _make_candle(o=100.0, h=100.0, l=100.0, c=100.0, v=0.0)
        m = extract_metrics(c)
        assert m.day_range == 0.0
        assert m.is_flat
        assert detect_marubozu_candle(m) is None
        assert detect_doji_candle(m) is None
        assert detect_spinning_top_candle(m) is None
        assert detect_hammer_or_hanging_man(m) is None

    def test_full_scan_finds_patterns(self):
        # Sequence ending with Bullish Engulfing
        candles = [
            _make_candle(time="2026-01-01", o=100.0, h=101.0, l=94.0, c=95.0),
            _make_candle(time="2026-01-02", o=94.0, h=104.0, l=93.0, c=102.0),
        ]
        results = scan_patterns(candles, lookback=2)
        pattern_names = [r.pattern for r in results]
        assert "Bullish Engulfing" in pattern_names
