"""
services/contextual_pattern_service.py
──────────────────────────────────────
Contextual Candlestick Pattern Enrichment Engine.

Transforms a raw pattern detection into an enriched, actionable analytical object:
  - Pattern name, direction, category, timestamp
  - Nearest support level & distance (₹ and %)
  - Nearest resistance level & distance (₹ and %)
  - Relative volume (RVOL) and volume classification
  - Broader market regime (e.g. TRENDING_UP, RANGE_BOUND)
  - Exponential moving average status (price vs EMA20)
  - 5-session trailing price change (%)
  - Deterministic contextual summary

Strictly deterministic: analytical context, NOT trading recommendations.
"""

from typing import Any
from dataclasses import dataclass, asdict

from api.services.pattern_engine import PatternDetection
from api.services.support_resistance_service import analyze_support_resistance
from api.services.volume_service import analyze_volume
from api.services.moving_average_service import analyze_moving_averages
from api.services.market_regime_service import classify_market_regime


@dataclass
class ContextualPattern:
    symbol: str
    pattern: str
    direction: str
    category: str
    timestamp: str
    current_price: float
    nearest_support_price: float | None
    support_distance_pct: float | None
    nearest_resistance_price: float | None
    resistance_distance_pct: float | None
    current_volume: float
    rvol: float
    volume_state: str
    market_regime: str
    price_vs_ema20: str
    five_session_change_pct: float
    context_summary: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def enrich_pattern_with_context(
    pattern: PatternDetection,
    candles: list[dict[str, Any]],
    symbol: str,
) -> ContextualPattern:
    """
    Enrich a single PatternDetection with comprehensive market structure context.
    """
    if not candles:
        return ContextualPattern(
            symbol=symbol,
            pattern=pattern.pattern,
            direction=pattern.direction,
            category=pattern.category,
            timestamp=pattern.timestamp,
            current_price=0.0,
            nearest_support_price=None,
            support_distance_pct=None,
            nearest_resistance_price=None,
            resistance_distance_pct=None,
            current_volume=0.0,
            rvol=1.0,
            volume_state="NORMAL",
            market_regime="MIXED",
            price_vs_ema20="UNAVAILABLE",
            five_session_change_pct=0.0,
            context_summary="No contextual candle data available.",
        )

    current_price = float(candles[-1]["close"])

    # Component evaluations
    sr_snap = analyze_support_resistance(candles, symbol)
    vol_snap = analyze_volume(candles, symbol)
    ma_snap = analyze_moving_averages(candles, symbol)
    regime_snap = classify_market_regime(candles, symbol)

    # 5-session trailing change
    if len(candles) >= 6:
        prior_close = float(candles[-6]["close"])
        five_day_pct = round(((current_price - prior_close) / prior_close * 100), 2)
    elif len(candles) > 1:
        prior_close = float(candles[0]["close"])
        five_day_pct = round(((current_price - prior_close) / prior_close * 100), 2)
    else:
        five_day_pct = 0.0

    sup = sr_snap.nearest_support
    res = sr_snap.nearest_resistance

    summary_parts = [
        f"{pattern.pattern} formed on {pattern.timestamp} at ₹{current_price:.2f}.",
    ]

    if sup:
        summary_parts.append(
            f"Nearest support at ₹{sup.price:.2f} ({sup.distance_pct:.1f}% below, {sup.touches} historical touches)."
        )
    if res:
        summary_parts.append(
            f"Nearest resistance at ₹{res.price:.2f} ({res.distance_pct:.1f}% above, {res.touches} historical touches)."
        )

    summary_parts.append(
        f"Volume is {vol_snap.volume_state} (RVOL: {vol_snap.rvol:.2f}x). "
        f"Trend regime: {regime_snap.regime}. Price is {ma_snap.price_vs_ema20.lower()} EMA20."
    )

    return ContextualPattern(
        symbol=symbol,
        pattern=pattern.pattern,
        direction=pattern.direction,
        category=pattern.category,
        timestamp=pattern.timestamp,
        current_price=round(current_price, 2),
        nearest_support_price=sup.price if sup else None,
        support_distance_pct=sup.distance_pct if sup else None,
        nearest_resistance_price=res.price if res else None,
        resistance_distance_pct=res.distance_pct if res else None,
        current_volume=vol_snap.current_volume,
        rvol=vol_snap.rvol,
        volume_state=vol_snap.volume_state,
        market_regime=regime_snap.regime,
        price_vs_ema20=ma_snap.price_vs_ema20,
        five_session_change_pct=five_day_pct,
        context_summary=" ".join(summary_parts),
    )
