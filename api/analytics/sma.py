"""
api/analytics/sma.py
────────────────────
Pure deterministic Simple Moving Average (SMA) calculation service and typed DTOs.
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
class SMAResult:
    period: int
    series: list[float | None]
    current: float | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SMACrossoverResult:
    fast_period: int
    slow_period: int
    relationship: CrossoverState

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class SMAService:
    """
    Stateless, pure mathematical service for Simple Moving Average calculations.
    """

    @staticmethod
    def calculate_series(closes: list[float], period: int) -> list[float | None]:
        """
        Calculate rolling Simple Moving Average series.
        """
        n = len(closes)
        result: list[float | None] = [None] * n
        if n < period or period <= 0:
            return result

        running_sum = sum(closes[:period])
        result[period - 1] = round(running_sum / period, 4)

        for i in range(period, n):
            running_sum += closes[i] - closes[i - period]
            result[i] = round(running_sum / period, 4)

        return result

    @classmethod
    def compute(cls, closes: list[float], period: int) -> SMAResult:
        """
        Compute full series and current value snapshot for a given SMA period.
        """
        series = cls.calculate_series(closes, period)
        current = series[-1] if series and series[-1] is not None else None
        return SMAResult(
            period=period,
            series=series,
            current=round(current, 2) if current is not None else None,
        )

    @staticmethod
    def evaluate_position(price: float, sma_val: float | None, threshold_pct: float = 0.001) -> PositionState:
        """
        Classify whether price is above, below, or essentially at the SMA.
        """
        if sma_val is None or sma_val <= 0:
            return "UNAVAILABLE"
        diff_pct = (price - sma_val) / sma_val
        if abs(diff_pct) <= threshold_pct:
            return "AT"
        return "ABOVE" if diff_pct > 0 else "BELOW"

    @staticmethod
    def evaluate_crossover(
        fast_series: list[float | None],
        slow_series: list[float | None],
        fast_period: int = 50,
        slow_period: int = 200,
        crossover_name_bull: CrossoverState = "BULLISH_CROSSOVER",
        crossover_name_bear: CrossoverState = "BEARISH_CROSSOVER",
    ) -> SMACrossoverResult:
        """
        Evaluate immediate crossover and alignment between fast and slow SMA series.
        """
        if len(fast_series) < 2 or len(slow_series) < 2:
            return SMACrossoverResult(fast_period, slow_period, "UNAVAILABLE")

        curr_fast = fast_series[-1]
        curr_slow = slow_series[-1]
        prev_fast = fast_series[-2]
        prev_slow = slow_series[-2]

        if curr_fast is None or curr_slow is None:
            return SMACrossoverResult(fast_period, slow_period, "UNAVAILABLE")

        if prev_fast is not None and prev_slow is not None:
            if prev_fast <= prev_slow and curr_fast > curr_slow:
                return SMACrossoverResult(fast_period, slow_period, crossover_name_bull)
            if prev_fast >= prev_slow and curr_fast < curr_slow:
                return SMACrossoverResult(fast_period, slow_period, crossover_name_bear)

        relationship: CrossoverState = "BULLISH_ALIGNMENT" if curr_fast > curr_slow else "BEARISH_ALIGNMENT"
        return SMACrossoverResult(fast_period, slow_period, relationship)
