"""
services/pattern_service.py
────────────────────────────
Marubozu candle pattern detection and Latest Candle Summary engine.

Implements textbook Marubozu logic from Zerodha Varsity — Chapter on Single Candlestick Patterns.

MARUBOZU DEFINITION (Varsity):
  A Marubozu candlestick has no upper or lower shadow (wicks).
  The entire session is dominated by buyers (bullish) or sellers (bearish).
  It signals strong directional conviction.

TRADE LOGIC (Varsity):
  The signal is NOT a direct entry signal.
  Day 1:  Marubozu detected → signal alert
  Day 2:  Confirmation session → entry on confirmation
  This function returns the Day 1 signal with a clear 'watch_next_session_for_confirmation' action.
"""

from typing import Any, Literal

from api.core.config import settings


# ---------------------------------------------------------------------------
# Thresholds — pulled from central config (api/core/config.py)
# Override via MARUBOZU_SHADOW_THRESHOLD / MARUBOZU_BODY_RANGE_RATIO env vars
# ---------------------------------------------------------------------------
MARUBOZU_SHADOW_THRESHOLD = settings.MARUBOZU_SHADOW_THRESHOLD
MARUBOZU_BODY_RANGE_RATIO = settings.MARUBOZU_BODY_RANGE_RATIO


def analyse_candle(candle: dict[str, Any]) -> dict[str, Any]:
    """
    Compute the Latest Candle Summary for a single OHLCV candle.

    Args:
        candle: Dict with keys: time, open, high, low, close, volume

    Returns:
        Dict matching the CandleSummary schema:
          date, open, high, low, close, body_pct, range_pct, direction
    """
    o = float(candle["open"])
    h = float(candle["high"])
    l = float(candle["low"])  # noqa: E741
    c = float(candle["close"])

    day_range = h - l
    body = abs(c - o)

    # Body as a percentage of the full day range (0–100%)
    body_pct = round((body / day_range * 100) if day_range > 0 else 0.0, 2)

    # Day range as a percentage of the opening price
    range_pct = round((day_range / o * 100) if o > 0 else 0.0, 2)

    # Candle direction
    if c > o:
        direction: Literal["bullish", "bearish", "doji"] = "bullish"
    elif c < o:
        direction = "bearish"
    else:
        direction = "doji"

    return {
        "date": candle["time"],
        "open": o,
        "high": h,
        "low": l,
        "close": c,
        "body_pct": body_pct,
        "range_pct": range_pct,
        "direction": direction,
    }


def detect_marubozu(
    candles: list[dict[str, Any]],
    symbol: str,
    display_name: str,
) -> dict[str, Any]:
    """
    Run Marubozu detection on the latest candle in the series.

    Logic (Varsity-aligned):
      - Compute upper shadow = high - max(open, close)
      - Compute lower shadow = min(open, close) - low
      - Bullish Marubozu:  upper_shadow ≤ threshold AND lower_shadow ≤ threshold AND close > open
      - Bearish Marubozu: upper_shadow ≤ threshold AND lower_shadow ≤ threshold AND close < open
      - Shadow threshold = MARUBOZU_SHADOW_THRESHOLD × body

    Args:
        candles:      Full list of OHLCV candle dicts (oldest → newest)
        symbol:       Ticker symbol
        display_name: Human-readable company name

    Returns:
        Dict matching PatternResponse schema.
    """
    if not candles:
        return _no_pattern_response(symbol, display_name, candle_summary=None)

    latest = candles[-1]
    candle_summary = analyse_candle(latest)

    o = float(latest["open"])
    h = float(latest["high"])
    l = float(latest["low"])   # noqa: E741
    c = float(latest["close"])
    body = abs(c - o)
    shadow_limit = body * MARUBOZU_SHADOW_THRESHOLD

    upper_shadow = h - max(o, c)
    lower_shadow = min(o, c) - l
    day_range = h - l
    body_to_range = (body / day_range) if day_range > 0 else 0.0

    is_marubozu = (
        upper_shadow <= shadow_limit
        and lower_shadow <= shadow_limit
        and body_to_range >= MARUBOZU_BODY_RANGE_RATIO
    )

    if is_marubozu and c > o:
        # Bullish Marubozu
        return {
            "symbol": symbol,
            "display_name": display_name,
            "pattern": "bullish_marubozu",
            "signal_day": latest["time"],
            "textbook_action": "watch_next_session_for_confirmation",
            "rationale": (
                f"{display_name} formed a Bullish Marubozu on {latest['time']}. "
                "Strong buying pressure dominated the entire session with negligible wicks. "
                "Per Varsity rules: wait for the next session to trade above today's close "
                "before initiating a long position. Entry on confirmation."
            ),
            "stop_loss": round(l, 2),  # Day's low is the stop-loss level
            "latest_candle": candle_summary,
            "data_note": "Near real-time data — Yahoo Finance delayed feed",
        }

    if is_marubozu and c < o:
        # Bearish Marubozu
        return {
            "symbol": symbol,
            "display_name": display_name,
            "pattern": "bearish_marubozu",
            "signal_day": latest["time"],
            "textbook_action": "watch_next_session_for_confirmation",
            "rationale": (
                f"{display_name} formed a Bearish Marubozu on {latest['time']}. "
                "Extreme selling pressure dominated the session from open to close. "
                "Per Varsity rules: watch for the next session to confirm breakdown below today's close. "
                "Potential short entry / exit signal on confirmation."
            ),
            "stop_loss": round(h, 2),  # Day's high is the stop-loss for shorts
            "latest_candle": candle_summary,
            "data_note": "Near real-time data — Yahoo Finance delayed feed",
        }

    # No Marubozu detected
    return _no_pattern_response(symbol, display_name, candle_summary)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _no_pattern_response(
    symbol: str,
    display_name: str,
    candle_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build a standard 'no pattern detected' response."""
    fallback_summary = candle_summary or {
        "date": "N/A",
        "open": 0.0,
        "high": 0.0,
        "low": 0.0,
        "close": 0.0,
        "body_pct": 0.0,
        "range_pct": 0.0,
        "direction": "doji",
    }
    return {
        "symbol": symbol,
        "display_name": display_name,
        "pattern": "none",
        "signal_day": None,
        "textbook_action": "no_marubozu_detected",
        "rationale": (
            f"No Marubozu pattern detected on the latest candle for {display_name}. "
            "The candle has visible shadows or an insufficient body-to-range ratio. "
            "Continue monitoring for a cleaner setup."
        ),
        "stop_loss": None,
        "latest_candle": fallback_summary,
        "data_note": "Near real-time data — Yahoo Finance delayed feed",
    }
