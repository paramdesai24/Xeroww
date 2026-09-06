"""
services/moving_average_service.py
──────────────────────────────────
Deterministic Moving Average Engine: SMA (20, 50, 200) and EMA (9, 20).

Implements textbook mathematical calculations:
  - SMA: Arithmetic rolling mean
  - EMA: Alpha-weighted recursive exponential moving average:
         alpha = 2 / (period + 1)
         Initial seed = SMA of first 'period' bars

Derives structural events:
  - Price above/below moving averages
  - Fast/slow EMA crossover (EMA9 vs EMA20)
  - Golden Cross (SMA50 crosses above SMA200)
  - Death Cross (SMA50 crosses below SMA200)

Pure present/historical structural states. Zero price predictions.
"""

from typing import Any, Literal
from dataclasses import dataclass, asdict


PositionState = Literal["ABOVE", "BELOW", "AT", "UNAVAILABLE"]
CrossoverState = Literal[
    "BULLISH_CROSSOVER",
    "BEARISH_CROSSOVER",
    "BULLISH_ALIGNMENT",
    "BEARISH_ALIGNMENT",
    "NEUTRAL",
    "UNAVAILABLE",
]


@dataclass
class MovingAverageSeriesPoint:
    time: str
    sma_20: float | None
    sma_50: float | None
    sma_200: float | None
    ema_9: float | None
    ema_20: float | None


@dataclass
class MovingAveragesSnapshot:
    symbol: str
    current_price: float
    sma_20: float | None
    sma_50: float | None
    sma_200: float | None
    ema_9: float | None
    ema_20: float | None
    price_vs_sma20: PositionState
    price_vs_sma50: PositionState
    price_vs_sma200: PositionState
    price_vs_ema9: PositionState
    price_vs_ema20: PositionState
    ema9_ema20_relationship: CrossoverState
    sma50_sma200_relationship: CrossoverState
    structural_summary: list[str]
    series: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def calculate_sma_series(closes: list[float], period: int) -> list[float | None]:
    """Calculate rolling Simple Moving Average series."""
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


def calculate_ema_series(closes: list[float], period: int) -> list[float | None]:
    """
    Calculate Exponential Moving Average series using textbook formula:
      alpha = 2 / (period + 1)
      seed = SMA(period)
      EMA_t = alpha * Close_t + (1 - alpha) * EMA_{t-1}
    """
    n = len(closes)
    result: list[float | None] = [None] * n
    if n < period or period <= 0:
        return result

    alpha = 2.0 / (period + 1.0)
    # Seed with SMA of first 'period' bars
    initial_sma = sum(closes[:period]) / period
    result[period - 1] = round(initial_sma, 4)

    prev_ema = initial_sma
    for i in range(period, n):
        curr_ema = (closes[i] * alpha) + (prev_ema * (1.0 - alpha))
        result[i] = round(curr_ema, 4)
        prev_ema = curr_ema

    return result


def evaluate_position(price: float, ma: float | None, threshold_pct: float = 0.001) -> PositionState:
    """Classify whether price is above, below, or essentially at a moving average."""
    if ma is None or ma <= 0:
        return "UNAVAILABLE"
    diff_pct = (price - ma) / ma
    if abs(diff_pct) <= threshold_pct:
        return "AT"
    return "ABOVE" if diff_pct > 0 else "BELOW"


def evaluate_crossover(
    fast_series: list[float | None],
    slow_series: list[float | None],
    crossover_name_bull: str = "BULLISH_CROSSOVER",
    crossover_name_bear: str = "BEARISH_CROSSOVER",
) -> CrossoverState:
    """
    Check if fast MA crossed slow MA on recent bars or current relative alignment.
    """
    if len(fast_series) < 2 or len(slow_series) < 2:
        return "UNAVAILABLE"

    curr_fast = fast_series[-1]
    curr_slow = slow_series[-1]
    prev_fast = fast_series[-2]
    prev_slow = slow_series[-2]

    if curr_fast is None or curr_slow is None:
        return "UNAVAILABLE"

    # Check immediate crossover on the current bar
    if prev_fast is not None and prev_slow is not None:
        if prev_fast <= prev_slow and curr_fast > curr_slow:
            return crossover_name_bull  # e.g., Golden Cross or Bullish Crossover
        if prev_fast >= prev_slow and curr_fast < curr_slow:
            return crossover_name_bear  # e.g., Death Cross or Bearish Crossover

    # If no immediate cross, return structural alignment
    return "BULLISH_ALIGNMENT" if curr_fast > curr_slow else "BEARISH_ALIGNMENT"


def analyze_moving_averages(
    candles: list[dict[str, Any]],
    symbol: str,
) -> MovingAveragesSnapshot:
    """
    Execute full moving average pipeline across available candle history.
    """
    if not candles:
        return MovingAveragesSnapshot(
            symbol=symbol,
            current_price=0.0,
            sma_20=None,
            sma_50=None,
            sma_200=None,
            ema_9=None,
            ema_20=None,
            price_vs_sma20="UNAVAILABLE",
            price_vs_sma50="UNAVAILABLE",
            price_vs_sma200="UNAVAILABLE",
            price_vs_ema9="UNAVAILABLE",
            price_vs_ema20="UNAVAILABLE",
            ema9_ema20_relationship="UNAVAILABLE",
            sma50_sma200_relationship="UNAVAILABLE",
            structural_summary=["Insufficient candle data for moving average calculation."],
            series=[],
        )

    closes = [float(c.get("close") or 0.0) for c in candles]
    times = [str(c.get("time", "")) for c in candles]
    current_price = closes[-1] if closes else 0.0

    sma20_series = calculate_sma_series(closes, 20)
    sma50_series = calculate_sma_series(closes, 50)
    sma200_series = calculate_sma_series(closes, 200)

    ema9_series = calculate_ema_series(closes, 9)
    ema20_series = calculate_ema_series(closes, 20)

    # Build lightweight points series
    series_points: list[dict[str, Any]] = []
    for i in range(len(candles)):
        series_points.append({
            "time": times[i],
            "sma_20": sma20_series[i],
            "sma_50": sma50_series[i],
            "sma_200": sma200_series[i],
            "ema_9": ema9_series[i],
            "ema_20": ema20_series[i],
        })

    # Latest values
    sma20_val = sma20_series[-1]
    sma50_val = sma50_series[-1]
    sma200_val = sma200_series[-1]
    ema9_val = ema9_series[-1]
    ema20_val = ema20_series[-1]

    # Evaluate positions
    pos_sma20 = evaluate_position(current_price, sma20_val)
    pos_sma50 = evaluate_position(current_price, sma50_val)
    pos_sma200 = evaluate_position(current_price, sma200_val)
    pos_ema9 = evaluate_position(current_price, ema9_val)
    pos_ema20 = evaluate_position(current_price, ema20_val)

    # Evaluate crossovers
    ema_rel = evaluate_crossover(
        ema9_series,
        ema20_series,
        crossover_name_bull="BULLISH_CROSSOVER",
        crossover_name_bear="BEARISH_CROSSOVER",
    )

    sma_rel = evaluate_crossover(
        sma50_series,
        sma200_series,
        crossover_name_bull="BULLISH_CROSSOVER",
        crossover_name_bear="BEARISH_CROSSOVER",
    )

    # Generate factual observations
    summary: list[str] = []
    if ema9_val and ema20_val:
        summary.append(f"Short-term momentum: EMA9 (₹{ema9_val:.2f}) is {'above' if ema9_val >= ema20_val else 'below'} EMA20 (₹{ema20_val:.2f}) [{ema_rel}].")
    if sma20_val:
        summary.append(f"Price is {pos_sma20.lower()} 20-period SMA (₹{sma20_val:.2f}).")
    if sma50_val and sma200_val:
        summary.append(f"Macro structure: SMA50 is {'above' if sma50_val >= sma200_val else 'below'} SMA200 [{sma_rel}].")

    return MovingAveragesSnapshot(
        symbol=symbol,
        current_price=round(current_price, 2),
        sma_20=round(sma20_val, 2) if sma20_val is not None else None,
        sma_50=round(sma50_val, 2) if sma50_val is not None else None,
        sma_200=round(sma200_val, 2) if sma200_val is not None else None,
        ema_9=round(ema9_val, 2) if ema9_val is not None else None,
        ema_20=round(ema20_val, 2) if ema20_val is not None else None,
        price_vs_sma20=pos_sma20,
        price_vs_sma50=pos_sma50,
        price_vs_sma200=pos_sma200,
        price_vs_ema9=pos_ema9,
        price_vs_ema20=pos_ema20,
        ema9_ema20_relationship=ema_rel,
        sma50_sma200_relationship=sma_rel,
        structural_summary=summary,
        series=series_points,
    )
