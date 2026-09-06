"""
api/tests/test_replay_and_diff.py
─────────────────────────────────
Unit test suite verifying:
1. Replay Engine chronological progression
2. Anti-Future-Data Leakage guarantees (state at T ignores T+1)
3. Deterministic Event Diff ("What Changed?") detection
4. Non-causal narrative language integrity
"""

from api.services.replay_service import ReplayEngine
from api.services.event_diff_service import EventDiffService


def generate_synthetic_series(n=30, base_price=100.0):
    """Generate deterministic synthetic candles."""
    candles = []
    for i in range(n):
        # Trending up slowly with volume expanding toward the end
        p = base_price + i * 2.0
        candles.append({
            "time": f"2026-01-{i+1:02d}",
            "open": p - 1.0,
            "high": p + 3.0,
            "low": p - 2.0,
            "close": p + 1.0,
            "volume": 100000 + i * 5000,
        })
    return candles


class TestReplayChronologyAndLeakage:

    def test_replay_step_bounds_and_slice_length(self):
        candles = generate_synthetic_series(20)
        engine = ReplayEngine("TEST.NS", candles)

        # Step 5 must contain exactly 6 candles (0 to 5)
        state_5 = engine.evaluate_at_step(5)
        assert state_5["current_step"] == 5
        assert len(state_5["candles_slice"]) == 6
        assert state_5["current_candle"]["time"] == "2026-01-06"
        assert not state_5["is_complete"]

        # Step 19 (last) must contain all 20 candles
        state_19 = engine.evaluate_at_step(19)
        assert state_19["current_step"] == 19
        assert len(state_19["candles_slice"]) == 20
        assert state_19["is_complete"]

    def test_strict_anti_future_leakage(self):
        """
        Inject a massive future spike at index 15.
        State at step 10 MUST NOT be influenced by the spike at step 15.
        """
        candles = generate_synthetic_series(20)
        # Normal series evaluation at step 10
        engine_normal = ReplayEngine("TEST.NS", candles)
        state_10_normal = engine_normal.evaluate_at_step(10)

        # Alter future candle at index 15 with catastrophic spike
        tampered_candles = [c.copy() for c in candles]
        tampered_candles[15]["close"] = 999999.0
        tampered_candles[15]["high"] = 999999.0
        tampered_candles[15]["volume"] = 999999999

        engine_tampered = ReplayEngine("TEST.NS", tampered_candles)
        state_10_tampered = engine_tampered.evaluate_at_step(10)

        # Slices up to 10 must be bit-identical
        assert state_10_normal["candles_slice"] == state_10_tampered["candles_slice"]
        # Moving averages, S/R, volume at step 10 must be identical
        assert state_10_normal["moving_averages"]["price_vs_ema20"] == state_10_tampered["moving_averages"]["price_vs_ema20"]
        assert state_10_normal["volume"]["rvol"] == state_10_tampered["volume"]["rvol"]
        assert state_10_normal["market_regime"]["regime"] == state_10_tampered["market_regime"]["regime"]

    def test_jump_to_timestamp(self):
        candles = generate_synthetic_series(15)
        engine = ReplayEngine("TEST.NS", candles)

        state = engine.evaluate_at_timestamp("2026-01-08")
        assert state["current_candle"]["time"] == "2026-01-08"
        assert state["current_step"] == 7


class TestEventDiffEngine:

    def test_detects_price_and_volume_diff(self):
        candles = generate_synthetic_series(15)
        # Make the last candle a sudden breakout
        candles[-1]["close"] = candles[-2]["close"] + 20.0
        candles[-1]["volume"] = candles[-2]["volume"] * 5

        diff_service = EventDiffService("TEST.NS", candles)
        diff = diff_service.diff_latest()

        assert diff["price_delta"] > 0
        assert diff["price_delta_pct"] > 0
        assert diff["event_count"] >= 2

        # Verify non-causal language in factual narrative
        for sentence in diff["factual_narrative"]:
            assert "caused" not in sentence.lower()

    def test_handles_insufficient_history(self):
        diff_service = EventDiffService("TEST.NS", [{"time": "2026-01-01", "close": 100, "volume": 100}])
        diff = diff_service.diff_latest()
        assert diff["event_count"] == 0
        assert "Insufficient historical data" in diff["factual_narrative"][0]
