"""Pure and inspectable portfolio performance calculations."""

import math
from statistics import stdev
from typing import Any


class PortfolioPerformanceService:
    VERSION = "PORTFOLIO-PERFORMANCE-V1"

    @classmethod
    def build(cls, snapshots) -> dict[str, Any]:
        ordered = sorted(snapshots, key=lambda item: item.as_of)
        if not ordered:
            return cls._empty("No portfolio snapshots are available.")
        values = [float(item.total_value) for item in ordered]
        dates = [item.as_of.isoformat() for item in ordered]
        benchmark = [float(item.benchmark_close) if item.benchmark_close is not None else None for item in ordered]
        returns = [values[index] / values[index - 1] - 1 for index in range(1, len(values)) if values[index - 1] > 0]
        absolute = values[-1] / values[0] - 1 if values[0] > 0 else None
        twr = math.prod(1 + value for value in returns) - 1 if returns else None
        benchmark_return = None
        valid_benchmark = [value for value in benchmark if value is not None]
        if len(valid_benchmark) >= 2 and valid_benchmark[0] > 0:
            benchmark_return = valid_benchmark[-1] / valid_benchmark[0] - 1
        volatility = stdev(returns) * math.sqrt(252) if len(returns) >= 2 else None
        drawdowns = []
        peak = values[0]
        peak_index = 0
        trough_index = 0
        drawdown_peak_index = 0
        minimum = 0.0
        for index, value in enumerate(values):
            if value > peak:
                peak = value
                peak_index = index
            drawdown = value / peak - 1 if peak else 0.0
            drawdowns.append(drawdown)
            if drawdown < minimum:
                minimum = drawdown
                trough_index = index
                drawdown_peak_index = peak_index
        recovered_at = None
        prior_peak = values[drawdown_peak_index]
        for index in range(trough_index + 1, len(values)):
            if values[index] >= prior_peak:
                recovered_at = dates[index]
                break
        quality = "COMPLETE" if len(ordered) >= 2 else "INSUFFICIENT"
        limitation = [] if quality == "COMPLETE" else ["At least two observed snapshots are required."]
        return {
            "absolute_return": cls._metric("absolute-return", absolute, "ratio", ordered, quality, limitation),
            "time_weighted_return": cls._metric("time-weighted-return", twr, "ratio", ordered, quality, limitation),
            "money_weighted_return": cls._metric(
                "money-weighted-return",
                absolute,
                "ratio",
                ordered,
                quality,
                ["No intermediate external cash flows exist in the current portfolio model."],
            ),
            "benchmark_return": cls._metric("nifty50-benchmark-return", benchmark_return, "ratio", ordered, quality, limitation),
            "excess_return": cls._metric(
                "excess-return",
                absolute - benchmark_return if absolute is not None and benchmark_return is not None else None,
                "ratio",
                ordered,
                quality if benchmark_return is not None else "INSUFFICIENT",
                limitation,
            ),
            "annualized_volatility": cls._metric(
                "annualized-volatility", volatility, "ratio", ordered, "COMPLETE" if volatility is not None else "INSUFFICIENT", ["Uses observed snapshot returns and a 252-period annualization factor."]
            ),
            "maximum_drawdown": cls._metric("maximum-drawdown", minimum, "ratio", ordered, quality, limitation),
            "drawdown_recovery": {
                "peak_at": dates[drawdown_peak_index],
                "trough_at": dates[trough_index],
                "recovered_at": recovered_at,
                "recovery_periods": (
                    dates.index(recovered_at) - trough_index if recovered_at is not None else None
                ),
                "open": recovered_at is None and minimum < 0,
            },
            "series": {
                "dates": dates,
                "portfolio_values": values,
                "benchmark_values": benchmark,
                "drawdowns": drawdowns,
            },
        }

    @classmethod
    def _metric(cls, formula_id, result, unit, snapshots, quality, limitations):
        return {
            "formula_id": formula_id,
            "formula_version": cls.VERSION,
            "observation_start": snapshots[0].as_of.isoformat() if snapshots else None,
            "observation_end": snapshots[-1].as_of.isoformat() if snapshots else None,
            "observation_count": len(snapshots),
            "inputs": {},
            "result": result,
            "unit": unit,
            "data_quality": quality,
            "limitations": limitations,
        }

    @classmethod
    def _empty(cls, message):
        return {"data_quality": "INSUFFICIENT", "limitations": [message], "series": {}}
