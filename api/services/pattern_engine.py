"""
services/pattern_engine.py
──────────────────────────
Deterministic Candlestick Pattern Engine V2.

Implements modular, mathematically precise candlestick pattern detection.
Every pattern detector returns structured data:
  - pattern: Pattern name
  - direction: "bullish" | "bearish" | "neutral"
  - candle_index: Index of the signal candle in the series
  - timestamp: Timestamp/date of the candle
  - body_ratio: Body size as fraction of range (0.0 to 1.0)
  - upper_shadow_ratio: Upper wick size as fraction of range (0.0 to 1.0)
  - lower_shadow_ratio: Lower wick size as fraction of range (0.0 to 1.0)
  - category: "reversal" | "continuation" | "indecision"
  - explanation: Deterministic factual rationale
  - context: Relevant measurements, stop-loss reference, and parameters

Zero machine learning, zero probabilistic predictions.
"""

from typing import Any, Literal
from dataclasses import dataclass, asdict


PatternDirection = Literal["bullish", "bearish", "neutral"]
PatternCategory = Literal["reversal", "continuation", "indecision"]


@dataclass
class CandleMetrics:
    """Normalized geometric metrics for a single candle."""
    index: int
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    day_range: float
    body: float
    upper_shadow: float
    lower_shadow: float
    body_ratio: float
    upper_shadow_ratio: float
    lower_shadow_ratio: float
    is_bullish: bool
    is_bearish: bool
    is_flat: bool


@dataclass
class PatternDetection:
    """Structured detection result for a candlestick pattern."""
    pattern: str
    direction: PatternDirection
    candle_index: int
    timestamp: str
    body_ratio: float
    upper_shadow_ratio: float
    lower_shadow_ratio: float
    category: PatternCategory
    explanation: str
    context: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def extract_metrics(candle: dict[str, Any], index: int = 0) -> CandleMetrics:
    """Extract and normalize all geometric properties of a candle."""
    o = float(candle.get("open", 0.0))
    h = float(candle.get("high", 0.0))
    l = float(candle.get("low", 0.0))  # noqa: E741
    c = float(candle.get("close", 0.0))
    v = float(candle.get("volume", 0.0))
    t = str(candle.get("time", ""))

    day_range = max(0.0, h - l)
    body = abs(c - o)
    upper_shadow = max(0.0, h - max(o, c))
    lower_shadow = max(0.0, min(o, c) - l)

    body_ratio = round((body / day_range) if day_range > 0 else 0.0, 4)
    upper_shadow_ratio = round((upper_shadow / day_range) if day_range > 0 else 0.0, 4)
    lower_shadow_ratio = round((lower_shadow / day_range) if day_range > 0 else 0.0, 4)

    return CandleMetrics(
        index=index,
        time=t,
        open=o,
        high=h,
        low=l,
        close=c,
        volume=v,
        day_range=day_range,
        body=body,
        upper_shadow=upper_shadow,
        lower_shadow=lower_shadow,
        body_ratio=body_ratio,
        upper_shadow_ratio=upper_shadow_ratio,
        lower_shadow_ratio=lower_shadow_ratio,
        is_bullish=c > o,
        is_bearish=c < o,
        is_flat=c == o or day_range == 0.0,
    )


# ---------------------------------------------------------------------------
# Marubozu Detector
# ---------------------------------------------------------------------------
def detect_marubozu_candle(
    m: CandleMetrics,
    shadow_threshold: float = 0.05,
    min_body_ratio: float = 0.80,
) -> PatternDetection | None:
    """
    Detect Bullish or Bearish Marubozu on a single candle.
    - Upper shadow ratio <= shadow_threshold (5% of range default)
    - Lower shadow ratio <= shadow_threshold (5% of range default)
    - Body ratio >= min_body_ratio (80% of range default)
    """
    if m.is_flat or m.day_range <= 0:
        return None

    if (
        m.upper_shadow_ratio <= shadow_threshold
        and m.lower_shadow_ratio <= shadow_threshold
        and m.body_ratio >= min_body_ratio
    ):
        if m.is_bullish:
            return PatternDetection(
                pattern="Bullish Marubozu",
                direction="bullish",
                candle_index=m.index,
                timestamp=m.time,
                body_ratio=m.body_ratio,
                upper_shadow_ratio=m.upper_shadow_ratio,
                lower_shadow_ratio=m.lower_shadow_ratio,
                category="continuation",
                explanation=(
                    f"Strong buyer dominance throughout session with minimal wicks "
                    f"(body constitutes {m.body_ratio * 100:.1f}% of day range). "
                    f"Stop-loss reference at session low: ₹{m.low:.2f}."
                ),
                context={
                    "stop_loss": round(m.low, 2),
                    "open": m.open,
                    "high": m.high,
                    "low": m.low,
                    "close": m.close,
                    "shadow_threshold": shadow_threshold,
                    "body_range_ratio": m.body_ratio,
                },
            )
        elif m.is_bearish:
            return PatternDetection(
                pattern="Bearish Marubozu",
                direction="bearish",
                candle_index=m.index,
                timestamp=m.time,
                body_ratio=m.body_ratio,
                upper_shadow_ratio=m.upper_shadow_ratio,
                lower_shadow_ratio=m.lower_shadow_ratio,
                category="continuation",
                explanation=(
                    f"Severe seller dominance throughout session with minimal wicks "
                    f"(body constitutes {m.body_ratio * 100:.1f}% of day range). "
                    f"Stop-loss reference at session high: ₹{m.high:.2f}."
                ),
                context={
                    "stop_loss": round(m.high, 2),
                    "open": m.open,
                    "high": m.high,
                    "low": m.low,
                    "close": m.close,
                    "shadow_threshold": shadow_threshold,
                    "body_range_ratio": m.body_ratio,
                },
            )
    return None
