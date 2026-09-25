"""
api/services/event_diff_service.py
──────────────────────────────────
Deterministic Market Event-Diff Engine for Xeroww ("What Changed?").

Principle:
- Compares market structure state between two historical points or consecutive bars.
- Detects:
  * Price changes & percentage jumps
  * Volume spikes & baseline state shifts
  * Support & Resistance breaches
  * Moving Average crossovers (EMA 9/20, SMA 50/200)
  * Candlestick pattern occurrences
  * Market Regime transitions
  * Signal Alignment shifts
- Language: Strictly NON-CAUSAL.
  Uses phrases such as "Observed alongside", "Coincident with", "Structure shifted".
  Never claims "X caused Y".
"""

from typing import Any
from api.services.replay_service import ReplayEngine


class EventDiffService:
    """Computes deterministic structural differences between two market states."""

    def __init__(self, symbol: str, all_candles: list[dict[str, Any]]):
        self.symbol = symbol
        self.engine = ReplayEngine(symbol, all_candles)
        self.total_bars = len(all_candles)

    def diff_steps(self, from_step: int, to_step: int) -> dict[str, Any]:
        """
        Compute deterministic diff between state at from_step and state at to_step.
        Requires 0 <= from_step < to_step < total_bars.
        """
        if self.total_bars < 2:
            return {
                "symbol": self.symbol,
                "from_step": from_step,
                "to_step": to_step,
                "from_time": None,
                "to_time": None,
                "price_delta": 0.0,
                "price_delta_pct": 0.0,
                "event_count": 0,
                "events": [],
                "factual_narrative": ["Insufficient historical data to construct event diff."],
            }

        clamped_from = max(0, min(from_step, self.total_bars - 2))
        clamped_to = max(clamped_from + 1, min(to_step, self.total_bars - 1))

        state_a = self.engine.evaluate_at_step(clamped_from)
        state_b = self.engine.evaluate_at_step(clamped_to)

        candle_a = state_a["current_candle"]
        candle_b = state_b["current_candle"]

        close_a = candle_a["close"] if candle_a else 0.0
        close_b = candle_b["close"] if candle_b else 0.0

        price_delta = round(close_b - close_a, 2)
        price_delta_pct = round((price_delta / close_a * 100) if close_a > 0 else 0.0, 2)

        events: list[dict[str, Any]] = []
        narrative: list[str] = []

        # 1. Price Movement
        events.append({
            "category": "PRICE",
            "type": "PRICE_MOVEMENT",
            "delta": price_delta,
            "delta_pct": price_delta_pct,
            "description": f"Price changed by {price_delta:+.2f} ({price_delta_pct:+.2f}%) from ₹{close_a:.2f} to ₹{close_b:.2f}.",
        })

        # 2. Volume State Changes
        vol_a = state_a["volume"]
        vol_b = state_b["volume"]
        if vol_a and vol_b:
            if vol_b["is_volume_spike"]:
                events.append({
                    "category": "VOLUME",
                    "type": "VOLUME_SPIKE",
                    "rvol": vol_b["rvol"],
                    "description": f"Volume expanded to {vol_b['rvol']}x baseline (observed alongside price movement).",
                })
            if vol_a["volume_state"] != vol_b["volume_state"]:
                events.append({
                    "category": "VOLUME",
                    "type": "VOLUME_STATE_TRANSITION",
                    "from_state": vol_a["volume_state"],
                    "to_state": vol_b["volume_state"],
                    "description": f"Volume state transitioned from {vol_a['volume_state']} to {vol_b['volume_state']}.",
                })

        # 3. Support & Resistance Level Breaches
        sr_a = state_a["support_resistance"]
        if sr_a and candle_b:
            # Check if any resistance in state_a was breached upward
            for r in (sr_a.get("resistance_zones") or []):
                lvl = r["price"]
                if close_a <= lvl < close_b:
                    events.append({
                        "category": "SUPPORT_RESISTANCE",
                        "type": "RESISTANCE_BREACHED",
                        "level": lvl,
                        "description": f"Resistance at ₹{lvl:.2f} was breached to the upside (close at ₹{close_b:.2f}).",
                    })
            # Check if any support in state_a was breached downward
            for s in (sr_a.get("support_zones") or []):
                lvl = s["price"]
                if close_a >= lvl > close_b:
                    events.append({
                        "category": "SUPPORT_RESISTANCE",
                        "type": "SUPPORT_BREACHED",
                        "level": lvl,
                        "description": f"Support at ₹{lvl:.2f} was breached to the downside (close at ₹{close_b:.2f}).",
                    })

        # 4. Moving Average Crosses / Position Changes
        ma_a = state_a["moving_averages"]
        ma_b = state_b["moving_averages"]
        if ma_a and ma_b:
            if ma_a["ema9_ema20_relationship"] != ma_b["ema9_ema20_relationship"]:
                events.append({
                    "category": "MOVING_AVERAGE",
                    "type": "EMA_RELATIONSHIP_CHANGE",
                    "from": ma_a["ema9_ema20_relationship"],
                    "to": ma_b["ema9_ema20_relationship"],
                    "description": f"EMA 9 vs EMA 20 structure shifted from {ma_a['ema9_ema20_relationship']} to {ma_b['ema9_ema20_relationship']}.",
                })
            if ma_a["price_vs_ema20"] != ma_b["price_vs_ema20"]:
                events.append({
                    "category": "MOVING_AVERAGE",
                    "type": "PRICE_VS_EMA20_CROSS",
                    "description": f"Price crossed EMA 20 from {ma_a['price_vs_ema20']} to {ma_b['price_vs_ema20']}.",
                })

        # 5. Market Regime Transition
        reg_a = state_a["market_regime"]
        reg_b = state_b["market_regime"]
        if reg_a and reg_b and reg_a["regime"] != reg_b["regime"]:
            events.append({
                "category": "REGIME",
                "type": "REGIME_TRANSITION",
                "from_regime": reg_a["regime"],
                "to_regime": reg_b["regime"],
                "description": f"Market regime transitioned from {reg_a['regime']} to {reg_b['regime']}.",
            })

        # 6. Signal Alignment Changes
        align_a = state_a["signal_alignment"]
        align_b = state_b["signal_alignment"]
        if align_a and align_b:
            delta_bull = align_b["bullish_alignment_count"] - align_a["bullish_alignment_count"]
            delta_bear = align_b["bearish_alignment_count"] - align_a["bearish_alignment_count"]
            if delta_bull != 0 or delta_bear != 0:
                events.append({
                    "category": "ALIGNMENT",
                    "type": "CONFLUENCE_CHANGE",
                    "bullish_change": delta_bull,
                    "bearish_change": delta_bear,
                    "description": f"Confluence score shifted: Bullish {align_a['bullish_alignment_count']} -> {align_b['bullish_alignment_count']}, Bearish {align_a['bearish_alignment_count']} -> {align_b['bearish_alignment_count']}.",
                })

        # 7. Detected Pattern in Destination Bar
        pat_b = state_b["pattern"]
        if pat_b:
            events.append({
                "category": "PATTERN",
                "type": "PATTERN_DETECTED",
                "pattern": pat_b["pattern"],
                "direction": pat_b["direction"],
                "description": f"{pat_b['pattern'].replace('_', ' ').title()} pattern observed at session close.",
            })

        # Construct non-causal narrative
        narrative.append(f"Between {candle_a['time']} and {candle_b['time']}, price moved {price_delta_pct:+.2f}%.")
        for ev in events[1:]:
            narrative.append(f"Observed alongside: {ev['description']}")

        return {
            "symbol": self.symbol,
            "from_step": clamped_from,
            "to_step": clamped_to,
            "from_time": candle_a["time"] if candle_a else None,
            "to_time": candle_b["time"] if candle_b else None,
            "price_delta": price_delta,
            "price_delta_pct": price_delta_pct,
            "event_count": len(events),
            "events": events,
            "factual_narrative": narrative,
        }

    def diff_latest(self) -> dict[str, Any]:
        """Convenience diff for the most recent session relative to previous session."""
        if self.total_bars < 2:
            return self.diff_steps(0, 0)
        return self.diff_steps(self.total_bars - 2, self.total_bars - 1)
