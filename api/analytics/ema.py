"""
api/analytics/ema.py
────────────────────
Pure deterministic Exponential Moving Average (EMA) calculation service and typed DTOs.
Prepared for Kafka/Spark stream processing with zero web framework dependencies.
"""

from dataclasses import dataclass, asdict
from typing import Any, Literal


PositionState = Literal["ABOVE", "BELOW", "AT", "UNAVAILABLE"]
CrossoverState = Literal[
    "BULLISH_CROSSOVER",
    "BEARISH_CROSSOVER",
    "BULLISH_ALIGNMENT",
    "BEARISH_ALIGNMENT",
    "NEUTRAL",
    "UNAVAILABLE",
]


@dataclass(frozen=True)
class EMAResult:
    period: int
    series: list[float | None]
    current: float | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EMACrossoverResult:
    fast_period: int
    slow_period: int
    relationship: CrossoverState

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class EMAService:
    """
    Stateless, pure mathematical service for Exponential Moving Average calculations.
    """

    @staticmethod
    def calculate_series(closes: list[float], period: int) -> list[float | None]:
        """
        Calculate Exponential Moving Average series using standard mathematical formulation:
          alpha = 2 / (period + 1)
          seed = SMA(first `period` bars)
          EMA_t = alpha * Close_t + (1 - alpha) * EMA_{t-1}
        """
        n = len(closes)
        result: list[float | None] = [None] * n
        if n < period or period <= 0:
            return result

        alpha = 2.0 / (period + 1.0)
        initial_sma = sum(closes[:period]) / period
        result[period - 1] = round(initial_sma, 4)

        prev_ema = initial_sma
        for i in range(period, n):
            curr_ema = (closes[i] * alpha) + (prev_ema * (1.0 - alpha))
            result[i] = round(curr_ema, 4)
            prev_ema = curr_ema

        return result

    @classmethod
    def compute(cls, closes: list[float], period: int) -> EMAResult:
        """
        Compute full series and current value snapshot for a given EMA period.
        """
        series = cls.calculate_series(closes, period)
        current = series[-1] if series and series[-1] is not None else None
        return EMAResult(
            period=period,
            series=series,
            current=round(current, 2) if current is not None else None,
        )

    @staticmethod
    def evaluate_position(price: float, ema_val: float | None, threshold_pct: float = 0.001) -> PositionState:
        """
        Classify whether price is above, below, or essentially at the EMA.
        """
        if ema_val is None or ema_val <= 0:
            return "UNAVAILABLE"
        diff_pct = (price - ema_val) / ema_val
        if abs(diff_pct) <= threshold_pct:
            return "AT"
        return "ABOVE" if diff_pct > 0 else "BELOW"

    @staticmethod
    def evaluate_crossover(
        fast_series: list[float | None],
        slow_series: list[float | None],
        fast_period: int = 9,
        slow_period: int = 20,
    ) -> EMACrossoverResult:
        """
        Evaluate immediate crossover and alignment between fast and slow EMA series.
        """
        if len(fast_series) < 2 or len(slow_series) < 2:
            return EMACrossoverResult(fast_period, slow_period, "UNAVAILABLE")

        curr_fast = fast_series[-1]
        curr_slow = slow_series[-1]
        prev_fast = fast_series[-2]
        prev_slow = slow_series[-2]

        if curr_fast is None or curr_slow is None:
            return EMACrossoverResult(fast_period, slow_period, "UNAVAILABLE")

        if prev_fast is not None and prev_slow is not None:
            if prev_fast <= prev_slow and curr_fast > curr_slow:
                return EMACrossoverResult(fast_period, slow_period, "BULLISH_CROSSOVER")
            if prev_fast >= prev_slow and curr_fast < curr_slow:
                return EMACrossoverResult(fast_period, slow_period, "BEARISH_CROSSOVER")

        relationship: CrossoverState = "BULLISH_ALIGNMENT" if curr_fast > curr_slow else "BEARISH_ALIGNMENT"
        return EMACrossoverResult(fast_period, slow_period, relationship)
