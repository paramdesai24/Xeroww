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


# ---------------------------------------------------------------------------
# Doji Detector (Standard, Dragonfly, Gravestone, Long-Legged)
# ---------------------------------------------------------------------------
def detect_doji_candle(
    m: CandleMetrics,
    max_body_ratio: float = 0.05,
) -> PatternDetection | None:
    """
    Detect Doji variants on a single candle.
    - Body is extremely small: body_ratio <= max_body_ratio (5% of range default)
    - Valid non-zero day_range
    """
    if m.day_range <= 0:
        return None

    if m.body_ratio > max_body_ratio:
        return None

    # Classify Doji Subtype
    if m.upper_shadow_ratio <= 0.08 and m.lower_shadow_ratio >= 0.55:
        # Dragonfly Doji: Long lower shadow, open/high/close clustered at top
        return PatternDetection(
            pattern="Dragonfly Doji",
            direction="bullish",
            candle_index=m.index,
            timestamp=m.time,
            body_ratio=m.body_ratio,
            upper_shadow_ratio=m.upper_shadow_ratio,
            lower_shadow_ratio=m.lower_shadow_ratio,
            category="reversal",
            explanation=(
                f"Dragonfly Doji formed at ₹{m.close:.2f}. Sellers drove price down to ₹{m.low:.2f}, "
                f"but aggressive buyers rejected lower levels, closing near the high. "
                f"Lower shadow accounts for {m.lower_shadow_ratio * 100:.1f}% of the range."
            ),
            context={
                "subtype": "dragonfly",
                "stop_loss": round(m.low, 2),
                "open": m.open,
                "high": m.high,
                "low": m.low,
                "close": m.close,
            },
        )
    elif m.lower_shadow_ratio <= 0.08 and m.upper_shadow_ratio >= 0.55:
        # Gravestone Doji: Long upper shadow, open/low/close clustered at bottom
        return PatternDetection(
            pattern="Gravestone Doji",
            direction="bearish",
            candle_index=m.index,
            timestamp=m.time,
            body_ratio=m.body_ratio,
            upper_shadow_ratio=m.upper_shadow_ratio,
            lower_shadow_ratio=m.lower_shadow_ratio,
            category="reversal",
            explanation=(
                f"Gravestone Doji formed at ₹{m.close:.2f}. Buyers drove price up to ₹{m.high:.2f}, "
                f"but sellers completely overwhelmed the advance, closing near the low. "
                f"Upper shadow accounts for {m.upper_shadow_ratio * 100:.1f}% of the range."
            ),
            context={
                "subtype": "gravestone",
                "stop_loss": round(m.high, 2),
                "open": m.open,
                "high": m.high,
                "low": m.low,
                "close": m.close,
            },
        )
    elif m.upper_shadow_ratio >= 0.25 and m.lower_shadow_ratio >= 0.25:
        # Long-Legged Doji
        return PatternDetection(
            pattern="Long-Legged Doji",
            direction="neutral",
            candle_index=m.index,
            timestamp=m.time,
            body_ratio=m.body_ratio,
            upper_shadow_ratio=m.upper_shadow_ratio,
            lower_shadow_ratio=m.lower_shadow_ratio,
            category="indecision",
            explanation=(
                f"Long-Legged Doji indicates extreme equilibrium and volatility between buyers and sellers. "
                f"Wide total range (₹{m.day_range:.2f}) with close virtually matching open."
            ),
            context={
                "subtype": "long_legged",
                "open": m.open,
                "high": m.high,
                "low": m.low,
                "close": m.close,
            },
        )
    else:
        # Standard Doji
        return PatternDetection(
            pattern="Doji",
            direction="neutral",
            candle_index=m.index,
            timestamp=m.time,
            body_ratio=m.body_ratio,
            upper_shadow_ratio=m.upper_shadow_ratio,
            lower_shadow_ratio=m.lower_shadow_ratio,
            category="indecision",
            explanation=(
                f"Standard Doji candle indicates market indecision at ₹{m.close:.2f}. "
                f"Neither buyers nor sellers could establish directional control."
            ),
            context={
                "subtype": "standard",
                "open": m.open,
                "high": m.high,
                "low": m.low,
                "close": m.close,
            },
        )


# ---------------------------------------------------------------------------
# Spinning Top Detector
# ---------------------------------------------------------------------------
def detect_spinning_top_candle(
    m: CandleMetrics,
    min_body_ratio: float = 0.05,
    max_body_ratio: float = 0.30,
    min_shadow_ratio: float = 0.20,
) -> PatternDetection | None:
    """
    Detect Spinning Top on a single candle.
    - Small real body: min_body_ratio <= body_ratio <= max_body_ratio (5% to 30%)
    - Both upper and lower shadows significant: shadow_ratio >= min_shadow_ratio (20% each)
    - Represents balance of forces / pause in trend
    """
    if m.day_range <= 0:
        return None

    if (
        min_body_ratio <= m.body_ratio <= max_body_ratio
        and m.upper_shadow_ratio >= min_shadow_ratio
        and m.lower_shadow_ratio >= min_shadow_ratio
    ):
        return PatternDetection(
            pattern="Spinning Top",
            direction="neutral",
            candle_index=m.index,
            timestamp=m.time,
            body_ratio=m.body_ratio,
            upper_shadow_ratio=m.upper_shadow_ratio,
            lower_shadow_ratio=m.lower_shadow_ratio,
            category="indecision",
            explanation=(
                f"Spinning Top observed with a tight body ({m.body_ratio * 100:.1f}% of range) "
                f"and symmetric shadows (upper: {m.upper_shadow_ratio * 100:.1f}%, "
                f"lower: {m.lower_shadow_ratio * 100:.1f}%). Signifies market standoff."
            ),
            context={
                "open": m.open,
                "high": m.high,
                "low": m.low,
                "close": m.close,
                "body_ratio": m.body_ratio,
            },
        )
    return None


# ---------------------------------------------------------------------------
# Hammer & Hanging Man Detector
# ---------------------------------------------------------------------------
def detect_hammer_or_hanging_man(
    current: CandleMetrics,
    prior: CandleMetrics | None = None,
    min_lower_ratio: float = 0.50,
    max_upper_ratio: float = 0.12,
    max_body_ratio: float = 0.35,
) -> PatternDetection | None:
    """
    Detect Hammer (bullish reversal) or Hanging Man (bearish reversal).
    - Small real body at the top of the price range (body_ratio <= 35%)
    - Lower shadow is at least twice the size of the body (and >= 50% of range)
    - Very small or absent upper shadow (upper_shadow_ratio <= 12%)
    - Direction determined by prior trend context:
        * Downtrend context (prior candle closing lower or bearish) -> Hammer
        * Uptrend context (prior candle closing higher or bullish) -> Hanging Man
    """
    if current.day_range <= 0 or current.body_ratio <= 0.02:
        return None

    is_hammer_shape = (
        current.body_ratio <= max_body_ratio
        and current.lower_shadow_ratio >= min_lower_ratio
        and current.upper_shadow_ratio <= max_upper_ratio
        and current.lower_shadow >= (1.8 * current.body)
    )

    if not is_hammer_shape:
        return None

    # Contextual determination based on prior candle if available
    is_downtrend = False
    if prior:
        is_downtrend = prior.is_bearish or (prior.close > current.close)
    else:
        # Default to Hammer geometry if no prior context
        is_downtrend = True

    if is_downtrend:
        return PatternDetection(
            pattern="Hammer",
            direction="bullish",
            candle_index=current.index,
            timestamp=current.time,
            body_ratio=current.body_ratio,
            upper_shadow_ratio=current.upper_shadow_ratio,
            lower_shadow_ratio=current.lower_shadow_ratio,
            category="reversal",
            explanation=(
                f"Bullish Hammer formed at ₹{current.close:.2f}. "
                f"Intraday sell-off to ₹{current.low:.2f} was vigorously rejected, "
                f"with lower wick measuring {current.lower_shadow_ratio * 100:.1f}% of total range. "
                f"Stop-loss reference at session low: ₹{current.low:.2f}."
            ),
            context={
                "stop_loss": round(current.low, 2),
                "lower_shadow_to_body_ratio": round(
                    current.lower_shadow / current.body if current.body > 0 else 0.0, 2
                ),
                "open": current.open,
                "high": current.high,
                "low": current.low,
                "close": current.close,
            },
        )
    else:
        return PatternDetection(
            pattern="Hanging Man",
            direction="bearish",
            candle_index=current.index,
            timestamp=current.time,
            body_ratio=current.body_ratio,
            upper_shadow_ratio=current.upper_shadow_ratio,
            lower_shadow_ratio=current.lower_shadow_ratio,
            category="reversal",
            explanation=(
                f"Bearish Hanging Man formed after upward advance at ₹{current.close:.2f}. "
                f"Heavy intraday selling pressure emerged down to ₹{current.low:.2f}. "
                f"Although buyers recovered by close, the long lower shadow warns of fragility at the top."
            ),
            context={
                "stop_loss": round(current.high, 2),
                "open": current.open,
                "high": current.high,
                "low": current.low,
                "close": current.close,
            },
        )


# ---------------------------------------------------------------------------
# Engulfing Detectors (Bullish & Bearish)
# ---------------------------------------------------------------------------
def detect_engulfing(
    current: CandleMetrics,
    prior: CandleMetrics | None,
) -> PatternDetection | None:
    """
    Detect Bullish or Bearish Engulfing pattern across two consecutive candles.
    - Bullish Engulfing: Prior candle is bearish, current is bullish, current body covers prior body.
    - Bearish Engulfing: Prior candle is bullish, current is bearish, current body covers prior body.
    """
    if not prior or prior.day_range <= 0 or current.day_range <= 0:
        return None

    # Bullish Engulfing
    if prior.is_bearish and current.is_bullish:
        if current.open <= prior.close and current.close >= prior.open:
            stop_loss = min(current.low, prior.low)
            return PatternDetection(
                pattern="Bullish Engulfing",
                direction="bullish",
                candle_index=current.index,
                timestamp=current.time,
                body_ratio=current.body_ratio,
                upper_shadow_ratio=current.upper_shadow_ratio,
                lower_shadow_ratio=current.lower_shadow_ratio,
                category="reversal",
                explanation=(
                    f"Bullish Engulfing: Buyers completely consumed prior session's selling range. "
                    f"Current green body (₹{current.open:.2f} -> ₹{current.close:.2f}) engulfs "
                    f"prior red body (₹{prior.open:.2f} -> ₹{prior.close:.2f}). "
                    f"Stop-loss reference at pattern low: ₹{stop_loss:.2f}."
                ),
                context={
                    "stop_loss": round(stop_loss, 2),
                    "prior_candle": {"time": prior.time, "open": prior.open, "close": prior.close},
                    "current_candle": {"time": current.time, "open": current.open, "close": current.close},
                },
            )

    # Bearish Engulfing
    if prior.is_bullish and current.is_bearish:
        if current.open >= prior.close and current.close <= prior.open:
            stop_loss = max(current.high, prior.high)
            return PatternDetection(
                pattern="Bearish Engulfing",
                direction="bearish",
                candle_index=current.index,
                timestamp=current.time,
                body_ratio=current.body_ratio,
                upper_shadow_ratio=current.upper_shadow_ratio,
                lower_shadow_ratio=current.lower_shadow_ratio,
                category="reversal",
                explanation=(
                    f"Bearish Engulfing: Sellers completely erased prior session's gains. "
                    f"Current red body (₹{current.open:.2f} -> ₹{current.close:.2f}) engulfs "
                    f"prior green body (₹{prior.open:.2f} -> ₹{prior.close:.2f}). "
                    f"Stop-loss reference at pattern high: ₹{stop_loss:.2f}."
                ),
                context={
                    "stop_loss": round(stop_loss, 2),
                    "prior_candle": {"time": prior.time, "open": prior.open, "close": prior.close},
                    "current_candle": {"time": current.time, "open": current.open, "close": current.close},
                },
            )

    return None


# ---------------------------------------------------------------------------
# Harami Detectors (Bullish & Bearish Inside Bars)
# ---------------------------------------------------------------------------
def detect_harami(
    current: CandleMetrics,
    prior: CandleMetrics | None,
) -> PatternDetection | None:
    """
    Detect Bullish or Bearish Harami (Inside Day).
    - Bullish Harami: Large red candle followed by a smaller green/neutral candle inside prior body.
    - Bearish Harami: Large green candle followed by a smaller red/neutral candle inside prior body.
    """
    if not prior or prior.day_range <= 0 or current.day_range <= 0:
        return None

    # Current body must be noticeably smaller than prior body
    if current.body >= (0.75 * prior.body):
        return None

    # Bullish Harami: prior is bearish, current body is inside prior body
    if prior.is_bearish and (current.open >= prior.close and current.close <= prior.open):
        return PatternDetection(
            pattern="Bullish Harami",
            direction="bullish",
            candle_index=current.index,
            timestamp=current.time,
            body_ratio=current.body_ratio,
            upper_shadow_ratio=current.upper_shadow_ratio,
            lower_shadow_ratio=current.lower_shadow_ratio,
            category="reversal",
            explanation=(
                f"Bullish Harami (Inside Bar): Downward momentum abruptly halted. "
                f"Current session (₹{current.open:.2f} -> ₹{current.close:.2f}) traded entirely "
                f"within prior bearish span (₹{prior.open:.2f} -> ₹{prior.close:.2f})."
            ),
            context={
                "stop_loss": round(prior.low, 2),
                "prior_body": round(prior.body, 2),
                "current_body": round(current.body, 2),
            },
        )

    # Bearish Harami: prior is bullish, current body is inside prior body
    if prior.is_bullish and (current.open <= prior.close and current.close >= prior.open):
        return PatternDetection(
            pattern="Bearish Harami",
            direction="bearish",
            candle_index=current.index,
            timestamp=current.time,
            body_ratio=current.body_ratio,
            upper_shadow_ratio=current.upper_shadow_ratio,
            lower_shadow_ratio=current.lower_shadow_ratio,
            category="reversal",
            explanation=(
                f"Bearish Harami (Inside Bar): Upward buying thrust contained. "
                f"Current session (₹{current.open:.2f} -> ₹{current.close:.2f}) closed inside "
                f"prior large bullish bar (₹{prior.open:.2f} -> ₹{prior.close:.2f})."
            ),
            context={
                "stop_loss": round(prior.high, 2),
                "prior_body": round(prior.body, 2),
                "current_body": round(current.body, 2),
            },
        )

    return None


# ---------------------------------------------------------------------------
# Morning Star & Evening Star (3-Candle Reversal)
# ---------------------------------------------------------------------------
def detect_star_patterns(
    c1: CandleMetrics,
    c2: CandleMetrics,
    c3: CandleMetrics,
) -> PatternDetection | None:
    """
    Detect Morning Star or Evening Star across 3 candles (c1 -> c2 -> c3).
    - Morning Star:
        c1: Solid bearish candle (body_ratio >= 0.40)
        c2: Star candle with small body (body_ratio <= 0.35) below c1
        c3: Solid bullish candle closing at or above midpoint of c1
    - Evening Star:
        c1: Solid bullish candle (body_ratio >= 0.40)
        c2: Star candle with small body (body_ratio <= 0.35) above c1
        c3: Solid bearish candle closing at or below midpoint of c1
    """
    if c1.day_range <= 0 or c2.day_range <= 0 or c3.day_range <= 0:
        return None

    # Morning Star
    if c1.is_bearish and c1.body_ratio >= 0.40 and c2.body_ratio <= 0.35 and c3.is_bullish:
        c1_midpoint = c1.open - (c1.body * 0.50)
        # Star opens/trades lower and c3 recovers past midpoint
        if max(c2.open, c2.close) <= (c1.close + (0.15 * c1.body)) and c3.close >= c1_midpoint:
            stop_loss = min(c1.low, c2.low, c3.low)
            return PatternDetection(
                pattern="Morning Star",
                direction="bullish",
                candle_index=c3.index,
                timestamp=c3.time,
                body_ratio=c3.body_ratio,
                upper_shadow_ratio=c3.upper_shadow_ratio,
                lower_shadow_ratio=c3.lower_shadow_ratio,
                category="reversal",
                explanation=(
                    f"Morning Star 3-candle bottom reversal: Heavy sell-off on {c1.time}, "
                    f"star compression on {c2.time}, followed by aggressive bullish thrust "
                    f"penetrating {((c3.close - c1.close)/c1.body)*100:.1f}% into initial red bar. "
                    f"Stop-loss reference: ₹{stop_loss:.2f}."
                ),
                context={
                    "stop_loss": round(stop_loss, 2),
                    "c1_date": c1.time,
                    "c2_date": c2.time,
                    "c3_date": c3.time,
                    "c1_midpoint": round(c1_midpoint, 2),
                    "c3_close": round(c3.close, 2),
                },
            )

    # Evening Star
    if c1.is_bullish and c1.body_ratio >= 0.40 and c2.body_ratio <= 0.35 and c3.is_bearish:
        c1_midpoint = c1.open + (c1.body * 0.50)
        # Star trades near high and c3 drops past midpoint
        if min(c2.open, c2.close) >= (c1.close - (0.15 * c1.body)) and c3.close <= c1_midpoint:
            stop_loss = max(c1.high, c2.high, c3.high)
            return PatternDetection(
                pattern="Evening Star",
                direction="bearish",
                candle_index=c3.index,
                timestamp=c3.time,
                body_ratio=c3.body_ratio,
                upper_shadow_ratio=c3.upper_shadow_ratio,
                lower_shadow_ratio=c3.lower_shadow_ratio,
                category="reversal",
                explanation=(
                    f"Evening Star 3-candle top reversal: Upward rally on {c1.time}, "
                    f"star exhaustion on {c2.time}, followed by decisive bearish counter-attack "
                    f"closing below midpoint (₹{c1_midpoint:.2f}) of initial green bar. "
                    f"Stop-loss reference: ₹{stop_loss:.2f}."
                ),
                context={
                    "stop_loss": round(stop_loss, 2),
                    "c1_date": c1.time,
                    "c2_date": c2.time,
                    "c3_date": c3.time,
                    "c1_midpoint": round(c1_midpoint, 2),
                    "c3_close": round(c3.close, 2),
                },
            )

    return None


# ---------------------------------------------------------------------------
# Gap Detection
# ---------------------------------------------------------------------------
def detect_gaps(
    current: CandleMetrics,
    prior: CandleMetrics | None,
) -> PatternDetection | None:
    """
    Detect price gaps between prior session high/low and current session low/high.
    - Gap Up: current.low > prior.high
    - Gap Down: current.high < prior.low
    """
    if not prior or prior.day_range <= 0 or current.day_range <= 0:
        return None

    if current.low > prior.high:
        gap_size = current.low - prior.high
        gap_pct = (gap_size / prior.high) * 100
        return PatternDetection(
            pattern="Gap Up",
            direction="bullish",
            candle_index=current.index,
            timestamp=current.time,
            body_ratio=current.body_ratio,
            upper_shadow_ratio=current.upper_shadow_ratio,
            lower_shadow_ratio=current.lower_shadow_ratio,
            category="continuation",
            explanation=(
                f"Bullish Gap Up: Today's low (₹{current.low:.2f}) opened cleanly above "
                f"yesterday's high (₹{prior.high:.2f}), leaving a ₹{gap_size:.2f} (+{gap_pct:.2f}%) unfilled window."
            ),
            context={
                "gap_size": round(gap_size, 2),
                "gap_pct": round(gap_pct, 2),
                "prior_high": prior.high,
                "current_low": current.low,
            },
        )

    if current.high < prior.low:
        gap_size = prior.low - current.high
        gap_pct = (gap_size / prior.low) * 100
        return PatternDetection(
            pattern="Gap Down",
            direction="bearish",
            candle_index=current.index,
            timestamp=current.time,
            body_ratio=current.body_ratio,
            upper_shadow_ratio=current.upper_shadow_ratio,
            lower_shadow_ratio=current.lower_shadow_ratio,
            category="continuation",
            explanation=(
                f"Bearish Gap Down: Today's high (₹{current.high:.2f}) opened cleanly below "
                f"yesterday's low (₹{prior.low:.2f}), leaving a ₹{gap_size:.2f} (-{gap_pct:.2f}%) unfilled window."
            ),
            context={
                "gap_size": round(gap_size, 2),
                "gap_pct": round(gap_pct, 2),
                "prior_low": prior.low,
                "current_high": current.high,
            },
        )

    return None


# ---------------------------------------------------------------------------
# Unified Multi-Candle Pattern Scanner
# ---------------------------------------------------------------------------
def scan_patterns(
    candles: list[dict[str, Any]],
    lookback: int = 5,
) -> list[PatternDetection]:
    """
    Scan candle history and return all detected patterns within the lookback window.
    Evaluates:
      - Single-candle: Marubozu, Doji, Spinning Top, Hammer, Hanging Man
      - Multi-candle: Bullish/Bearish Engulfing, Bullish/Bearish Harami, Morning/Evening Star, Gaps
    """
    if not candles:
        return []

    metrics_list = [extract_metrics(c, i) for i, c in enumerate(candles)]
    n = len(metrics_list)
    start_idx = max(0, n - lookback)

    detections: list[PatternDetection] = []

    for i in range(start_idx, n):
        cur = metrics_list[i]
        prev = metrics_list[i - 1] if i > 0 else None
        prev2 = metrics_list[i - 2] if i > 1 else None

        # 1. Marubozu
        m = detect_marubozu_candle(cur)
        if m:
            detections.append(m)

        # 2. Doji
        d = detect_doji_candle(cur)
        if d:
            detections.append(d)

        # 3. Spinning Top
        st = detect_spinning_top_candle(cur)
        if st:
            detections.append(st)

        # 4. Hammer or Hanging Man
        h = detect_hammer_or_hanging_man(cur, prev)
        if h:
            detections.append(h)

        # 5. Gaps
        if prev:
            g = detect_gaps(cur, prev)
            if g:
                detections.append(g)

        # 6. Engulfing
        if prev:
            eng = detect_engulfing(cur, prev)
            if eng:
                detections.append(eng)

        # 7. Harami
        if prev:
            har = detect_harami(cur, prev)
            if har:
                detections.append(har)

        # 8. Star Patterns (3 candles)
        if prev and prev2:
            star = detect_star_patterns(prev2, prev, cur)
            if star:
                detections.append(star)

    return detections

