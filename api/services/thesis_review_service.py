"""
api/services/thesis_review_service.py
─────────────────────────────────────
Decision Journal Thesis Review Engine for Xeroww.

Principle:
"Users can record a market decision/thesis with optional target or invalidation condition.
When historical data exists, Xeroww compares the recorded thesis with what actually happened.
A thesis review says things like:
  INITIAL CONTEXT: bullish structure, close above EMA20, resistance breakout
  LATER OBSERVATION: breakout held/failed, regime changed, price changed, volume normalized
Do not judge the user. Do not provide financial advice."
"""

from typing import Any
from api.models.intelligence import DecisionJournalEntry
from api.services.replay_service import ReplayEngine


class ThesisReviewService:
    """Performs objective audit of past trade theses against subsequent market data."""

    def __init__(self, market_data):
        self.market_data = market_data

    def _get_candles(self, symbol: str) -> tuple[str, list[dict[str, Any]]]:
        if hasattr(self.market_data, "get_candles"):
            return self.market_data.get_candles(symbol, period="1y", interval="1d")
        normalized = self.market_data.normalize_symbol(symbol)
        candles = self.market_data.get_ohlc(normalized, period="1y", interval="1d")
        return normalized, candles

    def review_entry(self, entry: DecisionJournalEntry) -> dict[str, Any]:
        """
        Compare snapshot context of entry at creation time against subsequent data.
        """
        try:
            symbol, candles = self._get_candles(entry.symbol)
        except Exception:
            provider = getattr(self.market_data, "provider", self.market_data)
            symbol = provider.normalize_symbol(entry.symbol)
            candles = []

        if not candles:
            return {
                "journal_id": entry.id,
                "symbol": symbol,
                "action": entry.action,
                "thesis": entry.thesis,
                "status": entry.status,
                "review_available": False,
                "note": "Market data unavailable for thesis verification.",
            }

        engine = ReplayEngine(symbol, candles)
        source_time = getattr(entry, "source_as_of", None)
        entry_time = (source_time or entry.timestamp).strftime("%Y-%m-%d")

        # Initial context state (at or before entry date)
        initial_state = engine.evaluate_at_timestamp(entry_time)
        latest_state = engine.evaluate_at_step(len(candles) - 1)

        init_candle = initial_state["current_candle"]
        latest_candle = latest_state["current_candle"]

        init_close = init_candle["close"] if init_candle else 0.0
        latest_close = latest_candle["close"] if latest_candle else 0.0

        price_delta = round(latest_close - init_close, 2)
        price_delta_pct = round((price_delta / init_close * 100) if init_close > 0 else 0.0, 2)

        # Initial Context summary
        init_summary = []
        if initial_state["market_regime"]:
            init_summary.append(f"Regime: {initial_state['market_regime']['regime']}")
        if initial_state["moving_averages"]:
            init_summary.append(f"Price was {initial_state['moving_averages']['price_vs_ema20']} (₹{init_close:.2f})")
        if initial_state["volume"]:
            init_summary.append(f"Volume state: {initial_state['volume']['volume_state']} ({initial_state['volume']['rvol']}x RVOL)")
        if initial_state["pattern"]:
            init_summary.append(f"Signal Pattern: {initial_state['pattern']['pattern']}")

        # Later Observation summary
        later_summary = []
        later_summary.append(f"Price moved {price_delta:+.2f} ({price_delta_pct:+.2f}%) to ₹{latest_close:.2f}")
        if latest_state["market_regime"]:
            later_summary.append(f"Current regime is {latest_state['market_regime']['regime']}")
        if latest_state["moving_averages"]:
            later_summary.append(f"Price is now {latest_state['moving_averages']['price_vs_ema20']}")
        if latest_state["volume"]:
            later_summary.append(f"Volume normalized to {latest_state['volume']['volume_state']}")

        return {
            "journal_id": entry.id,
            "symbol": symbol,
            "action": entry.action,
            "thesis": entry.thesis,
            "status": entry.status,
            "entry_date": entry_time,
            "latest_date": latest_candle["time"] if latest_candle else None,
            "entry_price": init_close,
            "latest_price": latest_close,
            "price_delta": price_delta,
            "price_delta_pct": price_delta_pct,
            "initial_context": init_summary,
            "later_observation": later_summary,
            "context_snapshot": entry.context_snapshot,
            "review_available": True,
        }
