"""
services/alert_evaluator.py
────────────────────────────
Alert evaluation engine for Xeroww.

Architecture:
  AlertEvaluator (ABC) — abstract interface for evaluation.
  StandardAlertEvaluator — concrete implementation using MarketDataProvider.

Design Intent:
  This evaluator is stateless and deterministic.
  It receives an Alert object + a market data snapshot and returns an evaluation result.
  This design enables future migration to a Kafka/Spark consumer event model:
    - KafkaMarketEventConsumer receives a tick event
    - Calls AlertEvaluator.evaluate(alert, market_snapshot)
    - No interface change required

Supported alert types:
  price_above          payload: {"threshold": float}
  price_below          payload: {"threshold": float}
  percentage_move      payload: {"pct": float, "direction": "up"|"down"|"any",
                                 "reference_price": float}
  volume_spike         payload: {"multiplier": float, "avg_volume": float}
  pattern_detected     payload: {"pattern": "bullish_marubozu"|"bearish_marubozu"|"any"}
  moving_average_cross payload: {"fast_period": int, "slow_period": int,
                                  "direction": "golden_cross"|"death_cross"|"any"}
"""

from abc import ABC, abstractmethod
from typing import Any

from api.models.alert import Alert
from api.schemas.alert import AlertEvaluationResult


class AlertEvaluator(ABC):
    """Abstract interface for alert evaluation. All implementations must fulfil this contract."""

    @abstractmethod
    def evaluate(self, alert: Alert) -> AlertEvaluationResult:
        """
        Evaluate whether an alert condition is triggered.

        Args:
            alert: The Alert ORM object with type and condition_payload.

        Returns:
            AlertEvaluationResult with triggered=True/False and contextual data.
        """
        ...


class StandardAlertEvaluator(AlertEvaluator):
    """
    Deterministic alert evaluator using the MarketDataProvider abstraction.
    Consumes live quotes and OHLC candles — never stores market data.
    """

    def __init__(self, provider=None):
        self._provider = provider

    def _get_provider(self):
        if self._provider is None:
            from api.core.dependencies import get_market_data_service
            self._provider = get_market_data_service()
        return self._provider

    def evaluate(self, alert: Alert) -> AlertEvaluationResult:
        """Route evaluation to the appropriate type handler."""
        handlers = {
            "price_above": self._eval_price_above,
            "price_below": self._eval_price_below,
            "percentage_move": self._eval_percentage_move,
            "volume_spike": self._eval_volume_spike,
            "pattern_detected": self._eval_pattern_detected,
            "moving_average_cross": self._eval_moving_average_cross,
        }

        handler = handlers.get(alert.alert_type.value if hasattr(alert.alert_type, 'value') else alert.alert_type)
        if not handler:
            return AlertEvaluationResult(
                alert_id=alert.id,
                symbol=alert.symbol,
                alert_type=str(alert.alert_type),
                triggered=False,
                current_value=None,
                condition_payload=alert.condition_payload,
                message=f"Unsupported alert type: {alert.alert_type}",
            )

        try:
            return handler(alert)
        except Exception as e:
            return AlertEvaluationResult(
                alert_id=alert.id,
                symbol=alert.symbol,
                alert_type=str(alert.alert_type),
                triggered=False,
                current_value=None,
                condition_payload=alert.condition_payload,
                message=f"Evaluation error: {e}",
            )

    def _get_quote(self, symbol: str) -> dict[str, Any]:
        return self._get_provider().get_quote(symbol)

    def _get_candles(self, symbol: str, period: str = "1mo") -> list[dict[str, Any]]:
        provider = self._get_provider()
        if hasattr(provider, "get_candles"):
            _, candles = provider.get_candles(symbol, period=period, interval="1d")
            return candles
        return provider.get_ohlc(symbol, period=period, interval="1d")

    # -----------------------------------------------------------------------
    # Type-specific evaluators
    # -----------------------------------------------------------------------

    def _eval_price_above(self, alert: Alert) -> AlertEvaluationResult:
        threshold = float(alert.condition_payload.get("threshold", 0))
        quote = self._get_quote(alert.symbol)
        price = quote["price"]
        triggered = price > threshold
        return AlertEvaluationResult(
            alert_id=alert.id,
            symbol=alert.symbol,
            alert_type="price_above",
            triggered=triggered,
            current_value=price,
            condition_payload=alert.condition_payload,
            message=(
                f"Price ₹{price:,.2f} {'>' if triggered else '≤'} threshold ₹{threshold:,.2f}"
            ),
        )

    def _eval_price_below(self, alert: Alert) -> AlertEvaluationResult:
        threshold = float(alert.condition_payload.get("threshold", 0))
        quote = self._get_quote(alert.symbol)
        price = quote["price"]
        triggered = price < threshold
        return AlertEvaluationResult(
            alert_id=alert.id,
            symbol=alert.symbol,
            alert_type="price_below",
            triggered=triggered,
            current_value=price,
            condition_payload=alert.condition_payload,
            message=(
                f"Price ₹{price:,.2f} {'<' if triggered else '≥'} threshold ₹{threshold:,.2f}"
            ),
        )

    def _eval_percentage_move(self, alert: Alert) -> AlertEvaluationResult:
        pct_target = float(alert.condition_payload.get("pct", 0))
        ref_price = float(alert.condition_payload.get("reference_price", 0))
        direction = alert.condition_payload.get("direction", "any")
        quote = self._get_quote(alert.symbol)
        price = quote["price"]

        if ref_price <= 0:
            return AlertEvaluationResult(
                alert_id=alert.id,
                symbol=alert.symbol,
                alert_type="percentage_move",
                triggered=False,
                current_value=price,
                condition_payload=alert.condition_payload,
                message="Invalid reference_price in condition_payload.",
            )

        actual_pct = ((price - ref_price) / ref_price) * 100
        if direction == "up":
            triggered = actual_pct >= pct_target
        elif direction == "down":
            triggered = actual_pct <= -pct_target
        else:  # "any"
            triggered = abs(actual_pct) >= pct_target

        return AlertEvaluationResult(
            alert_id=alert.id,
            symbol=alert.symbol,
            alert_type="percentage_move",
            triggered=triggered,
            current_value=round(actual_pct, 2),
            condition_payload=alert.condition_payload,
            message=f"Move: {actual_pct:+.2f}% vs target {pct_target:.2f}% ({direction})",
        )

    def _eval_volume_spike(self, alert: Alert) -> AlertEvaluationResult:
        multiplier = float(alert.condition_payload.get("multiplier", 2.0))
        quote = self._get_quote(alert.symbol)
        current_volume = quote.get("volume", 0)
        candles = self._get_candles(alert.symbol, period="1mo")
        if len(candles) < 5:
            avg_volume = current_volume
        else:
            recent_volumes = [c["volume"] for c in candles[-20:] if c["volume"] > 0]
            avg_volume = sum(recent_volumes) / len(recent_volumes) if recent_volumes else 0

        triggered = avg_volume > 0 and current_volume >= (avg_volume * multiplier)
        return AlertEvaluationResult(
            alert_id=alert.id,
            symbol=alert.symbol,
            alert_type="volume_spike",
            triggered=triggered,
            current_value=current_volume,
            condition_payload=alert.condition_payload,
            message=(
                f"Volume {current_volume:,} vs avg {avg_volume:,.0f} "
                f"(x{current_volume/avg_volume:.1f} vs x{multiplier} target)"
                if avg_volume > 0 else "Insufficient volume history."
            ),
        )

    def _eval_pattern_detected(self, alert: Alert) -> AlertEvaluationResult:
        target_pattern = alert.condition_payload.get("pattern", "any")
        candles = self._get_candles(alert.symbol, period="1mo")
        if not candles:
            return AlertEvaluationResult(
                alert_id=alert.id,
                symbol=alert.symbol,
                alert_type="pattern_detected",
                triggered=False,
                current_value=None,
                condition_payload=alert.condition_payload,
                message="No candle data available.",
            )
        from api.services.pattern_service import detect_marubozu
        result = detect_marubozu(candles, alert.symbol, alert.symbol)
        detected_pattern = result.get("pattern", "none")
        triggered = (
            detected_pattern != "none"
            and (target_pattern == "any" or target_pattern == detected_pattern)
        )
        return AlertEvaluationResult(
            alert_id=alert.id,
            symbol=alert.symbol,
            alert_type="pattern_detected",
            triggered=triggered,
            current_value=None,
            condition_payload=alert.condition_payload,
            message=f"Detected pattern: {detected_pattern} (target: {target_pattern})",
        )

    def _eval_moving_average_cross(self, alert: Alert) -> AlertEvaluationResult:
        fast_period = int(alert.condition_payload.get("fast_period", 9))
        slow_period = int(alert.condition_payload.get("slow_period", 21))
        direction = alert.condition_payload.get("direction", "any")
        candles = self._get_candles(alert.symbol, period="3mo")

        closes = [c["close"] for c in candles]
        if len(closes) < slow_period + 2:
            return AlertEvaluationResult(
                alert_id=alert.id,
                symbol=alert.symbol,
                alert_type="moving_average_cross",
                triggered=False,
                current_value=None,
                condition_payload=alert.condition_payload,
                message=f"Insufficient data for MA({fast_period}/{slow_period}).",
            )

        fast_ma_now = sum(closes[-fast_period:]) / fast_period
        slow_ma_now = sum(closes[-slow_period:]) / slow_period
        fast_ma_prev = sum(closes[-(fast_period + 1):-1]) / fast_period
        slow_ma_prev = sum(closes[-(slow_period + 1):-1]) / slow_period

        # Golden cross: fast crosses ABOVE slow (prev: fast < slow, now: fast >= slow)
        golden = fast_ma_prev < slow_ma_prev and fast_ma_now >= slow_ma_now
        # Death cross: fast crosses BELOW slow (prev: fast > slow, now: fast <= slow)
        death = fast_ma_prev > slow_ma_prev and fast_ma_now <= slow_ma_now

        triggered = (
            (direction == "golden_cross" and golden) or
            (direction == "death_cross" and death) or
            (direction == "any" and (golden or death))
        )
        cross_type = "golden" if golden else ("death" if death else "none")
        return AlertEvaluationResult(
            alert_id=alert.id,
            symbol=alert.symbol,
            alert_type="moving_average_cross",
            triggered=triggered,
            current_value=round(fast_ma_now, 2),
            condition_payload=alert.condition_payload,
            message=(
                f"MA{fast_period}={fast_ma_now:.2f} vs MA{slow_period}={slow_ma_now:.2f} "
                f"| Cross: {cross_type}"
            ),
        )
