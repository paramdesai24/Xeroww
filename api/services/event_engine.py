"""
services/event_engine.py
────────────────────────
Chronological Market Event & Explainability Engine.

Transforms historical market replay into a structured Git-like event ledger.
Emits deterministic MarketEvent domain models with zero forward-looking bias:
Every event at bar i is strictly derived from candles[0 : i + 1].

Supported Event Types:
  - PRICE_BREAKOUT
  - PRICE_BREAKDOWN
  - SUPPORT_TEST
  - RESISTANCE_REJECTION
  - PATTERN_DETECTED
  - EMA_CROSS
  - HIGH_RVOL
  - TREND_REVERSAL
"""

import hashlib
from typing import Any, List, Optional
from api.schemas.events import (
    MarketEvent,
    MarketEventType,
    EventSeverity,
    ExplainabilityPayload,
)
from api.services.pattern_engine import scan_patterns
from api.services.support_resistance_service import analyze_support_resistance
from api.services.volume_service import analyze_volume
from api.services.moving_average_service import analyze_moving_averages
from api.services.market_regime_service import classify_market_regime


def _generate_event_id(symbol: str, timestamp: str, event_type: str, candle_idx: int) -> str:
    raw = f"{symbol}:{timestamp}:{event_type}:{candle_idx}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    return f"evt-{h}"


class EventEngine:
    """
    Deterministic domain event generator for historical market data.
    """

    def __init__(self, symbol: str, all_candles: List[dict[str, Any]]):
        self.symbol = symbol
        self.all_candles = all_candles
        self.total_bars = len(all_candles)

    def detect_events_at_step(
        self,
        step_index: int,
        precomputed_slice: Optional[List[dict[str, Any]]] = None,
    ) -> List[MarketEvent]:
        """
        Detect all market events triggered exactly at step_index.
        Only uses candles[0 : step_index + 1]. Zero future leakage.
        """
        if step_index < 0 or step_index >= self.total_bars:
            return []

        curr_slice = precomputed_slice if precomputed_slice is not None else self.all_candles[0 : step_index + 1]
        if not curr_slice:
            return []

        curr_candle = curr_slice[-1]
        timestamp = str(curr_candle.get("time", ""))
        close_p = float(curr_candle.get("close", 0.0))
        open_p = float(curr_candle.get("open", 0.0))
        high_p = float(curr_candle.get("high", 0.0))
        low_p = float(curr_candle.get("low", 0.0))
        volume = float(curr_candle.get("volume", 0.0))
        is_bullish = close_p >= open_p

        events: List[MarketEvent] = []

        # Need minimal history for technical and structural indicators
        if step_index < 2:
            return events

        prev_slice = self.all_candles[0:step_index]
        prev_candle = prev_slice[-1]

        # 1. Volume & RVOL Analysis
        vol_current = analyze_volume(curr_slice, self.symbol)
        rvol = vol_current.rvol

        if rvol >= 2.0:
            rules = [
                f"RVOL ({rvol:.2f}x) >= 2.0x threshold",
                f"Current volume {int(volume):,} vs 20-period baseline {int(vol_current.baseline_avg_volume):,}",
            ]
            if vol_current.is_volume_spike:
                rules.append("Volume surge categorized as statistical spike")
            if vol_current.breakout_confirmed:
                rules.append("Directional volume expansion verified")

            confidence = round(min(1.0, 0.70 + (rvol - 2.0) * 0.1), 2)
            events.append(
                MarketEvent(
                    id=_generate_event_id(self.symbol, timestamp, MarketEventType.HIGH_RVOL.value, step_index),
                    timestamp=timestamp,
                    symbol=self.symbol,
                    type=MarketEventType.HIGH_RVOL,
                    severity=EventSeverity.WARNING if rvol < 3.5 else EventSeverity.CRITICAL,
                    title=f"RVOL Spike: {rvol:.2f}× Volume",
                    description=f"Institutional volume surge of {rvol:.2f}x over 20-bar baseline ({int(volume):,} shares).",
                    evidence=[
                        f"Session volume: {int(volume):,}",
                        f"Baseline avg volume: {int(vol_current.baseline_avg_volume):,}",
                        f"RVOL ratio: {rvol:.2f}x",
                    ],
                    candle_index=step_index,
                    explainability=ExplainabilityPayload(
                        signal="RVOL_SPIKE_THRESHOLD_CROSSED",
                        confidence=confidence,
                        evidence=[f"Volume = {int(volume):,}", f"20-period Mean = {int(vol_current.baseline_avg_volume):,}"],
                        triggeredRules=rules,
                    ),
                    metadata={"rvol": rvol, "volume": volume, "baseline": vol_current.baseline_avg_volume},
                )
            )

        # 2. Support / Resistance (Breakout, Breakdown, Test, Rejection)
        # S/R calculated up to previous bar or current bar to avoid lookahead
        sr_history = analyze_support_resistance(curr_slice, self.symbol)
        nearest_res = sr_history.nearest_resistance
        nearest_sup = sr_history.nearest_support

        # PRICE_BREAKOUT: Close penetrated resistance high
        if nearest_res and close_p > nearest_res.zone_high:
            prev_close = float(prev_candle.get("close", 0.0))
            if prev_close <= nearest_res.zone_high:
                rules = [
                    f"Close ₹{close_p:.2f} crossed above resistance ceiling ₹{nearest_res.zone_high:.2f}",
                    f"Zone tested {nearest_res.touches} times previously with strength score {nearest_res.strength:.1f}/10",
                ]
                if rvol >= 1.3:
                    rules.append(f"Volume confirmation with elevated RVOL {rvol:.2f}x")
                if is_bullish:
                    rules.append("Bullish candle closure above boundary")

                confidence = round(min(1.0, 0.75 + (0.15 if rvol >= 1.3 else 0.0) + (0.10 if is_bullish else 0.0)), 2)
                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, MarketEventType.PRICE_BREAKOUT.value, step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.PRICE_BREAKOUT,
                        severity=EventSeverity.CRITICAL,
                        title=f"Price Breakout above ₹{nearest_res.price:.2f}",
                        description=f"Close pierced resistance zone ₹{nearest_res.price:.2f} (ceiling ₹{nearest_res.zone_high:.2f}) on {rvol:.2f}x volume.",
                        evidence=[
                            f"Breakout price: ₹{close_p:.2f}",
                            f"Zone ceiling: ₹{nearest_res.zone_high:.2f}",
                            f"Prior touches: {nearest_res.touches}",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="RESISTANCE_ZONE_BREAKOUT",
                            confidence=confidence,
                            evidence=[f"Close ₹{close_p:.2f} > Zone High ₹{nearest_res.zone_high:.2f}"],
                            triggeredRules=rules,
                        ),
                        metadata={"resistance_price": nearest_res.price, "close": close_p, "touches": nearest_res.touches},
                    )
                )

        # PRICE_BREAKDOWN: Close penetrated support low
        if nearest_sup and close_p < nearest_sup.zone_low:
            prev_close = float(prev_candle.get("close", 0.0))
            if prev_close >= nearest_sup.zone_low:
                rules = [
                    f"Close ₹{close_p:.2f} breached support floor ₹{nearest_sup.zone_low:.2f}",
                    f"Support zone had {nearest_sup.touches} prior touches with strength {nearest_sup.strength:.1f}/10",
                ]
                if not is_bullish:
                    rules.append("Bearish candle closure below structure")
                if rvol >= 1.3:
                    rules.append(f"Selling expansion with RVOL {rvol:.2f}x")

                confidence = round(min(1.0, 0.75 + (0.15 if rvol >= 1.3 else 0.0) + (0.10 if not is_bullish else 0.0)), 2)
                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, MarketEventType.PRICE_BREAKDOWN.value, step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.PRICE_BREAKDOWN,
                        severity=EventSeverity.CRITICAL,
                        title=f"Price Breakdown below ₹{nearest_sup.price:.2f}",
                        description=f"Close breached support zone ₹{nearest_sup.price:.2f} (floor ₹{nearest_sup.zone_low:.2f}).",
                        evidence=[
                            f"Breakdown price: ₹{close_p:.2f}",
                            f"Support floor: ₹{nearest_sup.zone_low:.2f}",
                            f"Prior touches: {nearest_sup.touches}",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="SUPPORT_ZONE_BREAKDOWN",
                            confidence=confidence,
                            evidence=[f"Close ₹{close_p:.2f} < Zone Low ₹{nearest_sup.zone_low:.2f}"],
                            triggeredRules=rules,
                        ),
                        metadata={"support_price": nearest_sup.price, "close": close_p, "touches": nearest_sup.touches},
                    )
                )

        # SUPPORT_TEST: Session Low touched support without decisive close below
        if nearest_sup and close_p >= nearest_sup.zone_low:
            dist_to_sup_pct = abs(low_p - nearest_sup.price) / nearest_sup.price
            if dist_to_sup_pct <= 0.006:  # within 0.6%
                rules = [
                    f"Session low ₹{low_p:.2f} reached within {dist_to_sup_pct*100:.2f}% of support ₹{nearest_sup.price:.2f}",
                    f"Price defended floor: Close ₹{close_p:.2f} >= Zone Low ₹{nearest_sup.zone_low:.2f}",
                ]
                if is_bullish:
                    rules.append("Bullish candle rebound off support")

                confidence = round(0.80 if is_bullish else 0.65, 2)
                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, MarketEventType.SUPPORT_TEST.value, step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.SUPPORT_TEST,
                        severity=EventSeverity.INFO,
                        title=f"Support Tested at ₹{nearest_sup.price:.2f}",
                        description=f"Intraday low ₹{low_p:.2f} tested verified support zone ₹{nearest_sup.price:.2f} and held.",
                        evidence=[
                            f"Session low: ₹{low_p:.2f}",
                            f"Support price: ₹{nearest_sup.price:.2f}",
                            f"Distance: {dist_to_sup_pct*100:.2f}%",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="SUPPORT_LEVEL_DEFENDED",
                            confidence=confidence,
                            evidence=[f"Low ₹{low_p:.2f} within 0.6% of ₹{nearest_sup.price:.2f}"],
                            triggeredRules=rules,
                        ),
                        metadata={"support_price": nearest_sup.price, "low": low_p, "dist_pct": dist_to_sup_pct},
                    )
                )

        # RESISTANCE_REJECTION: Session High touched resistance but closed lower with upper shadow
        if nearest_res and close_p <= nearest_res.zone_high:
            dist_to_res_pct = abs(high_p - nearest_res.price) / nearest_res.price
            candle_range = max(0.01, high_p - low_p)
            upper_wick = high_p - max(open_p, close_p)
            upper_wick_ratio = upper_wick / candle_range

            if dist_to_res_pct <= 0.008 and upper_wick_ratio >= 0.25:
                rules = [
                    f"Session high ₹{high_p:.2f} probed resistance ₹{nearest_res.price:.2f}",
                    f"Upper wick ratio {upper_wick_ratio*100:.1f}% indicates supply rejection",
                    f"Close ₹{close_p:.2f} remained below ceiling ₹{nearest_res.zone_high:.2f}",
                ]
                confidence = round(0.75 + min(0.20, upper_wick_ratio * 0.3), 2)
                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, MarketEventType.RESISTANCE_REJECTION.value, step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.RESISTANCE_REJECTION,
                        severity=EventSeverity.WARNING,
                        title=f"Resistance Rejected at ₹{nearest_res.price:.2f}",
                        description=f"High ₹{high_p:.2f} rejected at resistance ₹{nearest_res.price:.2f} with {upper_wick_ratio*100:.0f}% upper shadow.",
                        evidence=[
                            f"Session high: ₹{high_p:.2f}",
                            f"Resistance price: ₹{nearest_res.price:.2f}",
                            f"Upper shadow ratio: {upper_wick_ratio:.2f}",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="RESISTANCE_SUPPLY_REJECTION",
                            confidence=confidence,
                            evidence=[f"High ₹{high_p:.2f} near ₹{nearest_res.price:.2f}", f"Upper Wick = {upper_wick_ratio*100:.1f}%"],
                            triggeredRules=rules,
                        ),
                        metadata={"resistance_price": nearest_res.price, "high": high_p, "upper_wick_ratio": upper_wick_ratio},
                    )
                )

        # 3. Candlestick Pattern Engine
        patterns = scan_patterns(curr_slice, lookback=1)
        if patterns:
            pat = patterns[-1]
            rules = [
                f"Textbook geometry satisfied: {pat.pattern}",
                f"Body ratio: {pat.body_ratio*100:.1f}% of range",
                f"Upper shadow: {pat.upper_shadow_ratio*100:.1f}%, Lower shadow: {pat.lower_shadow_ratio*100:.1f}%",
                f"Classification: {pat.category.upper()} in {pat.direction.upper()} direction",
            ]
            confidence = 0.85 if pat.body_ratio > 0.60 or pat.upper_shadow_ratio > 0.60 else 0.70
            severity = EventSeverity.WARNING if pat.direction == "bearish" else EventSeverity.INFO

            events.append(
                MarketEvent(
                    id=_generate_event_id(self.symbol, timestamp, MarketEventType.PATTERN_DETECTED.value, step_index),
                    timestamp=timestamp,
                    symbol=self.symbol,
                    type=MarketEventType.PATTERN_DETECTED,
                    severity=severity,
                    title=f"{pat.pattern} Detected",
                    description=f"{pat.explanation} ({pat.direction.capitalize()}).",
                    evidence=[
                        f"Pattern: {pat.pattern}",
                        f"Direction: {pat.direction}",
                        f"Body ratio: {pat.body_ratio*100:.1f}%",
                    ],
                    candle_index=step_index,
                    explainability=ExplainabilityPayload(
                        signal=f"PATTERN_{pat.pattern.upper().replace(' ', '_')}",
                        confidence=confidence,
                        evidence=[pat.explanation],
                        triggeredRules=rules,
                    ),
                    metadata={"pattern": pat.pattern, "direction": pat.direction, "category": pat.category},
                )
            )

        # 4. Moving Average Crossovers (EMA 9 vs EMA 20)
        ma_curr = analyze_moving_averages(curr_slice, self.symbol)
        ma_prev = analyze_moving_averages(prev_slice, self.symbol)

        if ma_curr.ema_9 is not None and ma_curr.ema_20 is not None and ma_prev.ema_9 is not None and ma_prev.ema_20 is not None:
            curr_diff = ma_curr.ema_9 - ma_curr.ema_20
            prev_diff = ma_prev.ema_9 - ma_prev.ema_20

            # Bullish EMA cross: prev <= 0, curr > 0
            if prev_diff <= 0 and curr_diff > 0:
                rules = [
                    f"EMA 9 (₹{ma_curr.ema_9:.2f}) crossed above EMA 20 (₹{ma_curr.ema_20:.2f})",
                    f"Spread expanded from {prev_diff:.2f} to +{curr_diff:.2f}",
                ]
                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, "EMA_CROSS_BULLISH", step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.EMA_CROSS,
                        severity=EventSeverity.INFO,
                        title="Bullish EMA Cross (9 > 20)",
                        description=f"Fast EMA 9 (₹{ma_curr.ema_9:.2f}) crossed above medium EMA 20 (₹{ma_curr.ema_20:.2f}).",
                        evidence=[
                            f"EMA 9: ₹{ma_curr.ema_9:.2f}",
                            f"EMA 20: ₹{ma_curr.ema_20:.2f}",
                            f"Spread: +{curr_diff:.2f}",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="EMA9_CROSS_ABOVE_EMA20",
                            confidence=0.85,
                            evidence=[f"EMA 9 (₹{ma_curr.ema_9:.2f}) > EMA 20 (₹{ma_curr.ema_20:.2f})"],
                            triggeredRules=rules,
                        ),
                        metadata={"ema_9": ma_curr.ema_9, "ema_20": ma_curr.ema_20, "spread": curr_diff},
                    )
                )
            # Bearish EMA cross: prev >= 0, curr < 0
            elif prev_diff >= 0 and curr_diff < 0:
                rules = [
                    f"EMA 9 (₹{ma_curr.ema_9:.2f}) crossed below EMA 20 (₹{ma_curr.ema_20:.2f})",
                    f"Spread deteriorated from +{prev_diff:.2f} to {curr_diff:.2f}",
                ]
                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, "EMA_CROSS_BEARISH", step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.EMA_CROSS,
                        severity=EventSeverity.WARNING,
                        title="Bearish EMA Cross (9 < 20)",
                        description=f"Fast EMA 9 (₹{ma_curr.ema_9:.2f}) slipped below medium EMA 20 (₹{ma_curr.ema_20:.2f}).",
                        evidence=[
                            f"EMA 9: ₹{ma_curr.ema_9:.2f}",
                            f"EMA 20: ₹{ma_curr.ema_20:.2f}",
                            f"Spread: {curr_diff:.2f}",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="EMA9_CROSS_BELOW_EMA20",
                            confidence=0.85,
                            evidence=[f"EMA 9 (₹{ma_curr.ema_9:.2f}) < EMA 20 (₹{ma_curr.ema_20:.2f})"],
                            triggeredRules=rules,
                        ),
                        metadata={"ema_9": ma_curr.ema_9, "ema_20": ma_curr.ema_20, "spread": curr_diff},
                    )
                )

        # 5. Trend Reversal (Market Regime transition)
        regime_curr = classify_market_regime(curr_slice, self.symbol)
        regime_prev = classify_market_regime(prev_slice, self.symbol)

        if regime_curr.regime != regime_prev.regime:
            curr_reg = regime_curr.regime.value
            prev_reg = regime_prev.regime.value

            # If switching between Bullish and Bearish, or from Ranging to Trend
            is_directional_shift = ("BULLISH" in curr_reg and "BEARISH" in prev_reg) or ("BEARISH" in curr_reg and "BULLISH" in prev_reg)
            if is_directional_shift or "TRANSITIONAL" in curr_reg or "TRANSITIONAL" in prev_reg:
                rules = [
                    f"Market regime flipped from {prev_reg} to {curr_reg}",
                    f"ADX: {regime_curr.adx:.1f} ({regime_curr.trend_strength.value})",
                    f"Directional indicators: +DI {regime_curr.plus_di:.1f} vs -DI {regime_curr.minus_di:.1f}",
                ]
                confidence = round(min(1.0, 0.65 + (regime_curr.adx / 100.0) * 0.35), 2)
                severity = EventSeverity.CRITICAL if is_directional_shift else EventSeverity.INFO

                events.append(
                    MarketEvent(
                        id=_generate_event_id(self.symbol, timestamp, MarketEventType.TREND_REVERSAL.value, step_index),
                        timestamp=timestamp,
                        symbol=self.symbol,
                        type=MarketEventType.TREND_REVERSAL,
                        severity=severity,
                        title=f"Trend Shift: {curr_reg.replace('_', ' ').title()}",
                        description=f"Regime transition detected: {prev_reg} → {curr_reg} (ADX {regime_curr.adx:.1f}).",
                        evidence=[
                            f"New regime: {curr_reg}",
                            f"Previous regime: {prev_reg}",
                            f"ADX strength: {regime_curr.adx:.1f}",
                        ],
                        candle_index=step_index,
                        explainability=ExplainabilityPayload(
                            signal="REGIME_TRANSITION_DETECTED",
                            confidence=confidence,
                            evidence=[f"{prev_reg} -> {curr_reg}"],
                            triggeredRules=rules,
                        ),
                        metadata={"from_regime": prev_reg, "to_regime": curr_reg, "adx": regime_curr.adx},
                    )
                )

        return events

    def generate_all_events(self) -> List[MarketEvent]:
        """
        Generate chronological timeline of all market events across the full historical series.
        Processes each bar strictly in historical order without forward leakage.
        """
        all_events: List[MarketEvent] = []
        for i in range(self.total_bars):
            # Evaluate events triggered at this step
            step_events = self.detect_events_at_step(i)
            all_events.extend(step_events)

        return all_events
