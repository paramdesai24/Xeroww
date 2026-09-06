"""
tests/test_market_regime.py
───────────────────────────
Deterministic unit tests for the Market Regime Engine.
"""

import pytest
from api.services.market_regime_service import classify_market_regime


def _bar(c, h=None, l=None, v=1000.0, t="2026-01-01"):
    return {
        "time": t,
        "open": c - 1.0,
        "high": h if h is not None else c + 2.0,
        "low": l if l is not None else c - 2.0,
        "close": c,
        "volume": v,
    }


class TestMarketRegimeClassification:
    def test_trending_up_classification(self):
        # 25 bars with steady upward stair-step
        candles = []
        for i in range(25):
            price = 100.0 + (i * 2.0)
            candles.append(_bar(c=price, v=1200.0, t=f"d{i}"))

        regime = classify_market_regime(candles, symbol="UP.NS")
        assert regime.regime == "TRENDING_UP"
        assert len(regime.reasons) >= 2
        assert any("Close" in r or "EMA" in r for r in regime.reasons)

    def test_trending_down_classification(self):
        # 25 bars with steady downward stair-step
        candles = []
        for i in range(25):
            price = 150.0 - (i * 2.0)
            candles.append(_bar(c=price, v=1200.0, t=f"d{i}"))

        regime = classify_market_regime(candles, symbol="DOWN.NS")
        assert regime.regime == "TRENDING_DOWN"
        assert len(regime.reasons) >= 2

    def test_range_bound_classification(self):
        # 25 bars oscillating tightly between 100.0 and 102.0 (tight range < 3%)
        candles = []
        for i in range(25):
            price = 100.0 if i % 2 == 0 else 101.5
            candles.append(_bar(c=price, h=102.0, l=99.8, v=800.0, t=f"d{i}"))

        regime = classify_market_regime(candles, symbol="RANGE.NS")
        assert regime.regime == "RANGE_BOUND"
        assert any("channel" in r.lower() or "bounded" in r.lower() for r in regime.reasons)

    def test_high_volatility_classification(self):
        # 20 bars with huge daily ranges (e.g. price 100, high 120, low 80 -> ATR% ~ 40%)
        candles = []
        for i in range(20):
            candles.append(_bar(c=100.0, h=120.0, l=80.0, v=1000.0, t=f"d{i}"))

        regime = classify_market_regime(candles, symbol="VOL.NS")
        assert regime.regime == "HIGH_VOLATILITY"

    def test_insufficient_data(self):
        regime = classify_market_regime([_bar(100.0)], symbol="TINY")
        assert regime.regime == "MIXED"
        assert "Insufficient" in regime.reasons[0]
