"""
services/market_regime_service.py
─────────────────────────────────
Deterministic Market Structure & Trend Regime Classification Engine.

Classifies the current market state into one of:
  - TRENDING_UP
  - TRENDING_DOWN
  - RANGE_BOUND
  - HIGH_VOLATILITY
  - LOW_ACTIVITY
  - MIXED

Pure rule-based taxonomy. Every output exposes the factual 'reasons' for its assignment.
NO machine learning, NO price prediction, NO fake confidence percentages.
"""

from typing import Any, Literal
from dataclasses import dataclass, asdict

from api.services.moving_average_service import (
    calculate_ema_series,
    calculate_sma_series,
)
from api.services.support_resistance_service import compute_atr, find_swing_points
from api.services.volume_service import analyze_volume


RegimeType = Literal[
    "TRENDING_UP",
    "TRENDING_DOWN",
    "RANGE_BOUND",
    "HIGH_VOLATILITY",
    "LOW_ACTIVITY",
    "MIXED",
]


@dataclass
class MarketRegime:
    symbol: str
    regime: RegimeType
    reasons: list[str]
    current_price: float
    atr_pct: float
    rvol: float
    swing_structure: str
    ema_trend: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def classify_market_regime(
    candles: list[dict[str, Any]],
    symbol: str,
) -> MarketRegime:
    """
    Classify the current market regime using deterministic rules.
    """
    if len(candles) < 5:
        return MarketRegime(
            symbol=symbol,
            regime="MIXED",
            reasons=["Insufficient historical candle data (< 5 sessions)."],
            current_price=float(candles[-1]["close"]) if candles else 0.0,
            atr_pct=0.0,
            rvol=1.0,
            swing_structure="INSUFFICIENT_DATA",
            ema_trend="UNAVAILABLE",
        )

    closes = [float(c["close"]) for c in candles]
    highs = [float(c["high"]) for c in candles]
    lows = [float(c["low"]) for c in candles]
    current_price = closes[-1]

    # 1. Moving Averages
    ema9_series = calculate_ema_series(closes, 9)
    ema20_series = calculate_ema_series(closes, 20)
    sma20_series = calculate_sma_series(closes, 20)

    ema9 = ema9_series[-1]
    ema20 = ema20_series[-1]
    sma20 = sma20_series[-1]

    # 2. Volatility (ATR %)
    atr = compute_atr(candles, period=14)
    atr_pct = round((atr / current_price * 100) if current_price > 0 else 0.0, 2)

    # 3. Volume analytics
    vol_analytics = analyze_volume(candles, symbol=symbol, baseline_window=20)
    rvol = vol_analytics.rvol

    # 4. Swing structure
    swings = find_swing_points(candles, left_bars=2, right_bars=2)
    swing_highs = [s for s in swings if s.point_type == "high"]
    swing_lows = [s for s in swings if s.point_type == "low"]

    swing_structure = "CONSOLIDATION"
    if len(swing_highs) >= 2 and len(swing_lows) >= 2:
        if swing_highs[-1].price > swing_highs[-2].price and swing_lows[-1].price > swing_lows[-2].price:
            swing_structure = "HIGHER_HIGHS_AND_LOWS"
        elif swing_highs[-1].price < swing_highs[-2].price and swing_lows[-1].price < swing_lows[-2].price:
            swing_structure = "LOWER_HIGHS_AND_LOWS"

    # 5. Price Range Compression (20-bar span)
    lookback_window = min(len(candles), 20)
    recent_high = max(highs[-lookback_window:])
    recent_low = min(lows[-lookback_window:])
    range_span_pct = ((recent_high - recent_low) / current_price * 100) if current_price > 0 else 0.0

    # -----------------------------------------------------------------------
    # Decision Engine: Evaluate rules and collect explanations
    # -----------------------------------------------------------------------
    reasons: list[str] = []
    regime: RegimeType = "MIXED"
    ema_trend = "FLAT"

    if ema9 and ema20:
        if ema9 > ema20:
            ema_trend = "BULLISH_EXPANSION"
        elif ema9 < ema20:
            ema_trend = "BEARISH_EXPANSION"

    # Rule 1: High Volatility
    if atr_pct >= 4.0:
        regime = "HIGH_VOLATILITY"
        reasons.append(f"High ATR% volatility: {atr_pct:.2f}% of price (exceeds 4.0% volatility threshold).")
        reasons.append(f"Wide 20-session trading envelope of {range_span_pct:.1f}% (high: ₹{recent_high:.2f}, low: ₹{recent_low:.2f}).")
        return MarketRegime(
            symbol=symbol,
            regime=regime,
            reasons=reasons,
            current_price=round(current_price, 2),
            atr_pct=atr_pct,
            rvol=rvol,
            swing_structure=swing_structure,
            ema_trend=ema_trend,
        )

    # Rule 2: Low Activity
    if rvol <= 0.55 and atr_pct <= 1.2:
        regime = "LOW_ACTIVITY"
        reasons.append(f"Subdued trading volume: RVOL of {rvol:.2f} (sub-baseline participation).")
        reasons.append(f"Compressed session range: ATR% of {atr_pct:.2f}%.")
        return MarketRegime(
            symbol=symbol,
            regime=regime,
            reasons=reasons,
            current_price=round(current_price, 2),
            atr_pct=atr_pct,
            rvol=rvol,
            swing_structure=swing_structure,
            ema_trend=ema_trend,
        )

    # Rule 3: Trending Up
    bullish_evidence: list[str] = []
    if ema20 and current_price > ema20:
        bullish_evidence.append(f"Close (₹{current_price:.2f}) > EMA20 (₹{ema20:.2f}).")
    if ema9 and ema20 and ema9 > ema20:
        bullish_evidence.append(f"Fast EMA9 (₹{ema9:.2f}) > Slow EMA20 (₹{ema20:.2f}).")
    if sma20 and current_price > sma20:
        bullish_evidence.append(f"Price positioned above 20-session baseline SMA (₹{sma20:.2f}).")
    if swing_structure == "HIGHER_HIGHS_AND_LOWS":
        bullish_evidence.append("Recent swing pivot highs and lows are ascending.")
    if rvol >= 1.1:
        bullish_evidence.append(f"Elevated volume activity (RVOL: {rvol:.2f}x).")

    # Rule 4: Trending Down
    bearish_evidence: list[str] = []
    if ema20 and current_price < ema20:
        bearish_evidence.append(f"Close (₹{current_price:.2f}) < EMA20 (₹{ema20:.2f}).")
    if ema9 and ema20 and ema9 < ema20:
        bearish_evidence.append(f"Fast EMA9 (₹{ema9:.2f}) < Slow EMA20 (₹{ema20:.2f}).")
    if sma20 and current_price < sma20:
        bearish_evidence.append(f"Price positioned below 20-session baseline SMA (₹{sma20:.2f}).")
    if swing_structure == "LOWER_HIGHS_AND_LOWS":
        bearish_evidence.append("Recent swing pivot highs and lows are descending.")
    if rvol >= 1.1:
        bearish_evidence.append(f"Elevated volume activity (RVOL: {rvol:.2f}x).")

    # Rule 3: Range Bound (Channel compression without directional swings)
    if range_span_pct <= 4.5 and lookback_window >= 12 and swing_structure not in ("HIGHER_HIGHS_AND_LOWS", "LOWER_HIGHS_AND_LOWS"):
        regime = "RANGE_BOUND"
        reasons.append(f"Price bounded within a tight {range_span_pct:.1f}% channel over last {lookback_window} sessions.")
        reasons.append(f"Boundary channel: ₹{recent_low:.2f} support to ₹{recent_high:.2f} resistance.")
        if ema9 and ema20:
            reasons.append(f"Moving averages convergent (EMA9: ₹{ema9:.2f}, EMA20: ₹{ema20:.2f}).")
    elif len(bullish_evidence) >= 3 and len(bearish_evidence) <= 1:
        regime = "TRENDING_UP"
        reasons = bullish_evidence
    elif len(bearish_evidence) >= 3 and len(bullish_evidence) <= 1:
        regime = "TRENDING_DOWN"
        reasons = bearish_evidence
    else:
        regime = "MIXED"
        reasons.append("Conflicting structural indicators across momentum and price averages.")
        if bullish_evidence:
            reasons.append(f"Bullish cues: {'; '.join(bullish_evidence)}.")
        if bearish_evidence:
            reasons.append(f"Bearish cues: {'; '.join(bearish_evidence)}.")

    return MarketRegime(
        symbol=symbol,
        regime=regime,
        reasons=reasons,
        current_price=round(current_price, 2),
        atr_pct=atr_pct,
        rvol=rvol,
        swing_structure=swing_structure,
        ema_trend=ema_trend,
    )
