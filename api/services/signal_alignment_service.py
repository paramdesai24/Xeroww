"""
services/signal_alignment_service.py
────────────────────────────────────
Deterministic Signal Alignment (Confluence) Engine.

Computes how many independent structural market conditions align in a bullish
or bearish direction.
Exposes the complete underlying conditions checklist.

Strictly deterministic:
  - NO probability percentage
  - NO win-rate prediction
  - NO AI confidence score
  - Pure condition tally: alignment_count / alignment_total
"""

from typing import Any, Literal
from dataclasses import dataclass, asdict

from api.services.moving_average_service import analyze_moving_averages
from api.services.volume_service import analyze_volume
from api.services.support_resistance_service import analyze_support_resistance
from api.services.market_regime_service import classify_market_regime
from api.services.pattern_engine import scan_patterns


@dataclass
class AlignmentCondition:
    condition_id: str
    label: str
    bias: Literal["bullish", "bearish"]
    satisfied: bool
    description: str


@dataclass
class SignalAlignmentResult:
    symbol: str
    current_price: float
    bullish_alignment_count: int
    bearish_alignment_count: int
    alignment_total: int
    dominant_bias: Literal["BULLISH_CONFLUENCE", "BEARISH_CONFLUENCE", "NEUTRAL_MIXED"]
    conditions: list[dict[str, Any]]
    factual_summary: str
    methodology_note: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def evaluate_signal_alignment(
    candles: list[dict[str, Any]],
    symbol: str,
) -> SignalAlignmentResult:
    """
    Evaluate structural confluence across moving averages, volume, S/R zones, and patterns.
    """
    if len(candles) < 5:
        return SignalAlignmentResult(
            symbol=symbol,
            current_price=float(candles[-1]["close"]) if candles else 0.0,
            bullish_alignment_count=0,
            bearish_alignment_count=0,
            alignment_total=6,
            dominant_bias="NEUTRAL_MIXED",
            conditions=[],
            factual_summary="Insufficient historical candle data to evaluate signal alignment.",
            methodology_note="Objective tally of independent market structure rules; not a prediction.",
        )

    current_price = float(candles[-1]["close"])

    # 1. Component analytics
    ma_snap = analyze_moving_averages(candles, symbol)
    vol_snap = analyze_volume(candles, symbol)
    sr_snap = analyze_support_resistance(candles, symbol)
    regime_snap = classify_market_regime(candles, symbol)
    patterns = scan_patterns(candles, lookback=3)

    recent_bull_patterns = [p for p in patterns if p.direction == "bullish"]
    recent_bear_patterns = [p for p in patterns if p.direction == "bearish"]

    # 2. Define 6 Bullish Conditions
    bull_c1 = AlignmentCondition(
        condition_id="bull_regime",
        label="Regime Alignment",
        bias="bullish",
        satisfied=regime_snap.regime == "TRENDING_UP",
        description=f"Market regime is classified as TRENDING_UP (currently {regime_snap.regime}).",
    )
    bull_c2 = AlignmentCondition(
        condition_id="bull_price_vs_ema20",
        label="Price Above EMA20",
        bias="bullish",
        satisfied=ma_snap.price_vs_ema20 == "ABOVE",
        description=f"Close (₹{current_price:.2f}) > EMA20 (₹{ma_snap.ema_20 or 0:.2f}).",
    )
    bull_c3 = AlignmentCondition(
        condition_id="bull_momentum",
        label="Short-term Momentum (EMA9 > EMA20)",
        bias="bullish",
        satisfied=(
            ma_snap.ema_9 is not None
            and ma_snap.ema_20 is not None
            and ma_snap.ema_9 > ma_snap.ema_20
        ),
        description=f"Fast EMA9 (₹{ma_snap.ema_9 or 0:.2f}) above slow EMA20 (₹{ma_snap.ema_20 or 0:.2f}).",
    )
    bull_c4 = AlignmentCondition(
        condition_id="bull_volume",
        label="Constructive Volume",
        bias="bullish",
        satisfied=vol_snap.volume_state in ("ELEVATED", "NORMAL") and vol_snap.price_volume_relationship in ("ACCUMULATION", "LOW_VOLUME_PULLBACK"),
        description=f"Volume profile constructive ({vol_snap.price_volume_relationship}, RVOL: {vol_snap.rvol}x).",
    )
    # Support proximity: within 3% of nearest support
    near_sup = sr_snap.nearest_support
    sup_prox = (near_sup is not None and near_sup.distance_pct <= 3.0)
    bull_c5 = AlignmentCondition(
        condition_id="bull_support_proximity",
        label="Support Zone Proximity",
        bias="bullish",
        satisfied=sup_prox,
        description=(
            f"Price is within {near_sup.distance_pct:.1f}% of support zone (₹{near_sup.price:.2f})"
            if near_sup else "No nearby support zone detected within 3%."
        ),
    )
    bull_c6 = AlignmentCondition(
        condition_id="bull_pattern",
        label="Bullish Candlestick Pattern",
        bias="bullish",
        satisfied=len(recent_bull_patterns) > 0,
        description=(
            f"Detected: {recent_bull_patterns[-1].pattern} on {recent_bull_patterns[-1].timestamp}"
            if recent_bull_patterns else "No active bullish candlestick pattern in last 3 sessions."
        ),
    )

    # 3. Define 6 Bearish Conditions
    bear_c1 = AlignmentCondition(
        condition_id="bear_regime",
        label="Regime Alignment",
        bias="bearish",
        satisfied=regime_snap.regime == "TRENDING_DOWN",
        description=f"Market regime is classified as TRENDING_DOWN (currently {regime_snap.regime}).",
    )
    bear_c2 = AlignmentCondition(
        condition_id="bear_price_vs_ema20",
        label="Price Below EMA20",
        bias="bearish",
        satisfied=ma_snap.price_vs_ema20 == "BELOW",
        description=f"Close (₹{current_price:.2f}) < EMA20 (₹{ma_snap.ema_20 or 0:.2f}).",
    )
    bear_c3 = AlignmentCondition(
        condition_id="bear_momentum",
        label="Short-term Momentum (EMA9 < EMA20)",
        bias="bearish",
        satisfied=(
            ma_snap.ema_9 is not None
            and ma_snap.ema_20 is not None
            and ma_snap.ema_9 < ma_snap.ema_20
        ),
        description=f"Fast EMA9 (₹{ma_snap.ema_9 or 0:.2f}) below slow EMA20 (₹{ma_snap.ema_20 or 0:.2f}).",
    )
    bear_c4 = AlignmentCondition(
        condition_id="bear_volume",
        label="Distribution Volume",
        bias="bearish",
        satisfied=vol_snap.price_volume_relationship == "DISTRIBUTION" or vol_snap.divergence_flag is not None,
        description=f"Volume indicates heavy selling or divergence ({vol_snap.price_volume_relationship}).",
    )
    # Resistance proximity: within 3% of nearest resistance
    near_res = sr_snap.nearest_resistance
    res_prox = (near_res is not None and near_res.distance_pct <= 3.0)
    bear_c5 = AlignmentCondition(
        condition_id="bear_resistance_proximity",
        label="Resistance Zone Proximity",
        bias="bearish",
        satisfied=res_prox,
        description=(
            f"Price is within {near_res.distance_pct:.1f}% of resistance zone (₹{near_res.price:.2f})"
            if near_res else "No nearby resistance zone detected within 3%."
        ),
    )
    bear_c6 = AlignmentCondition(
        condition_id="bear_pattern",
        label="Bearish Candlestick Pattern",
        bias="bearish",
        satisfied=len(recent_bear_patterns) > 0,
        description=(
            f"Detected: {recent_bear_patterns[-1].pattern} on {recent_bear_patterns[-1].timestamp}"
            if recent_bear_patterns else "No active bearish candlestick pattern in last 3 sessions."
        ),
    )

    bullish_list = [bull_c1, bull_c2, bull_c3, bull_c4, bull_c5, bull_c6]
    bearish_list = [bear_c1, bear_c2, bear_c3, bear_c4, bear_c5, bear_c6]

    bull_count = sum(1 for c in bullish_list if c.satisfied)
    bear_count = sum(1 for c in bearish_list if c.satisfied)

    if bull_count >= 4 and bull_count > bear_count:
        dominant_bias: Literal["BULLISH_CONFLUENCE", "BEARISH_CONFLUENCE", "NEUTRAL_MIXED"] = "BULLISH_CONFLUENCE"
    elif bear_count >= 4 and bear_count > bull_count:
        dominant_bias = "BEARISH_CONFLUENCE"
    else:
        dominant_bias = "NEUTRAL_MIXED"

    all_conditions = [asdict(c) for c in (bullish_list + bearish_list)]

    summary = (
        f"{bull_count} of 6 bullish conditions and {bear_count} of 6 bearish conditions satisfied. "
        f"Structural state: {dominant_bias}."
    )

    return SignalAlignmentResult(
        symbol=symbol,
        current_price=round(current_price, 2),
        bullish_alignment_count=bull_count,
        bearish_alignment_count=bear_count,
        alignment_total=6,
        dominant_bias=dominant_bias,
        conditions=all_conditions,
        factual_summary=summary,
        methodology_note=(
            "Signal alignment represents an unweighted count of deterministic structural criteria. "
            "It is not a probability, prediction, or trade recommendation."
        ),
    )
