"""
api/services/replay_service.py
──────────────────────────────
Chronological Market Replay Engine for Xeroww.

Guiding Principle:
"Prevent future leakage. During replay at time T, the UI/backend must NOT
use information from T+1 onward."

Architecture:
- The ReplayEngine takes the full historical series of candles for a symbol.
- When querying state at step index k (or timestamp T), it strictly slices
  candles[0 : k + 1].
- Downstream deterministic analytics (Moving Averages, Support/Resistance,
  Volume Engine, Market Regime, Signal Alignment, and Patterns) are computed
  exclusively using this historical slice.
- No forward-looking smoothing or future extrema are ever referenced.
"""

from typing import Any
from api.services.pattern_engine import scan_patterns
from api.services.support_resistance_service import analyze_support_resistance
from api.services.volume_service import analyze_volume
from api.services.moving_average_service import analyze_moving_averages
from api.services.market_regime_service import classify_market_regime
from api.services.signal_alignment_service import evaluate_signal_alignment


class ReplayEngine:
    """
    Manages chronological step-through and deterministic state evaluation
    for a single symbol over historical data.
    """

    def __init__(self, symbol: str, all_candles: list[dict[str, Any]]):
        self.symbol = symbol
        self.all_candles = all_candles
        self.total_bars = len(all_candles)

    def get_timeline(self) -> list[dict[str, Any]]:
        """Return the list of timestamps, closes, and indices for the scrubber."""
        return [
            {
                "index": i,
                "time": c["time"],
                "close": c["close"],
                "volume": c.get("volume", 0),
            }
            for i, c in enumerate(self.all_candles)
        ]

    def evaluate_at_step(self, step_index: int) -> dict[str, Any]:
        """
        Evaluate full market structure state at step_index without future data.

        step_index: 0-based index. If step_index >= total_bars, clamped to total_bars - 1.
        """
        if self.total_bars == 0:
            return {
                "symbol": self.symbol,
                "current_step": 0,
                "total_steps": 0,
                "current_candle": None,
                "candles_slice": [],
                "moving_averages": None,
                "support_resistance": None,
                "volume": None,
                "market_regime": None,
                "signal_alignment": None,
                "pattern": None,
            }

        # Clamp step_index strictly to valid range
        clamped_index = max(0, min(step_index, self.total_bars - 1))

        # ANTI-FUTURE-LEAKAGE SLICE: exactly up to clamped_index inclusive
        slice_candles = self.all_candles[0 : clamped_index + 1]
        current_candle = slice_candles[-1]

        # 1. Moving Averages computed exclusively on slice
        ma_analysis = analyze_moving_averages(slice_candles, self.symbol).to_dict()

        # 2. Support & Resistance computed exclusively on slice
        sr_analysis = analyze_support_resistance(slice_candles, self.symbol).to_dict()

        # 3. Volume Analytics computed exclusively on slice
        vol_analysis = analyze_volume(slice_candles, self.symbol).to_dict()

        # 4. Market Regime computed exclusively on slice
        regime_analysis = classify_market_regime(slice_candles, self.symbol).to_dict()

        # 5. Signal Alignment computed exclusively on slice
        alignment_analysis = evaluate_signal_alignment(slice_candles, self.symbol).to_dict()

        # 6. Candlestick Patterns evaluated on current candle using slice history
        patterns = scan_patterns(slice_candles, lookback=1)
        active_pattern = patterns[-1] if patterns else None
        pattern_dict = None
        if active_pattern:
            pattern_dict = {
                "pattern": active_pattern.pattern,
                "direction": active_pattern.direction,
                "category": active_pattern.category,
                "explanation": active_pattern.explanation,
                "body_ratio": active_pattern.body_ratio,
                "upper_shadow_ratio": active_pattern.upper_shadow_ratio,
                "lower_shadow_ratio": active_pattern.lower_shadow_ratio,
            }

        return {
            "symbol": self.symbol,
            "current_step": clamped_index,
            "total_steps": self.total_bars,
            "is_complete": clamped_index == (self.total_bars - 1),
            "current_candle": current_candle,
            "candles_slice": slice_candles,
            "moving_averages": ma_analysis,
            "support_resistance": sr_analysis,
            "volume": vol_analysis,
            "market_regime": regime_analysis,
            "signal_alignment": alignment_analysis,
            "pattern": pattern_dict,
        }


    def evaluate_at_timestamp(self, timestamp: str) -> dict[str, Any]:
        """Find the candle matching or closest preceding timestamp and evaluate."""
        target_idx = 0
        for i, c in enumerate(self.all_candles):
            if c["time"] <= timestamp:
                target_idx = i
            else:
                break
        return self.evaluate_at_step(target_idx)
