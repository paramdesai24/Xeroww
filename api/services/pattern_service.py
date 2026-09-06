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


from api.services.pattern_engine import (
    extract_metrics,
    detect_marubozu_candle,
    PatternDetection,
)


def detect_marubozu(
    candles: list[dict[str, Any]],
    symbol: str,
    display_name: str,
) -> dict[str, Any]:
    """
    Run Marubozu detection on the latest candle in the series.
    Delegates to the deterministic pattern engine V2.
    """
    if not candles:
        return _no_pattern_response(symbol, display_name, candle_summary=None)

    latest = candles[-1]
    candle_summary = analyse_candle(latest)
    metrics = extract_metrics(latest, index=len(candles) - 1)

    detection = detect_marubozu_candle(
        metrics,
        shadow_threshold=MARUBOZU_SHADOW_THRESHOLD,
        min_body_ratio=MARUBOZU_BODY_RANGE_RATIO,
    )

    if detection:
        pattern_key = "bullish_marubozu" if detection.direction == "bullish" else "bearish_marubozu"
        stop_loss = detection.context.get("stop_loss")
        return {
            "symbol": symbol,
            "display_name": display_name,
            "pattern": pattern_key,
            "signal_day": latest.get("time"),
            "textbook_action": "watch_next_session_for_confirmation",
            "rationale": detection.explanation,
            "stop_loss": stop_loss,
            "latest_candle": candle_summary,
            "data_note": "Near real-time data — Yahoo Finance delayed feed",
        }

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
