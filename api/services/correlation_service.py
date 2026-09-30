"""
api/services/correlation_service.py
───────────────────────────────────
Cross-Asset Relationship Explorer for Xeroww.

Principle:
"Build rolling correlation analytics between selected instruments.
Support 20-period and 50-period windows.
Display correlation matrix, pairwise correlation, and rolling correlation.
Be explicit: Correlation is not causation."
"""

import math
from typing import Any


def compute_pearson_correlation(series_a: list[float], series_b: list[float]) -> float:
    """Compute Pearson correlation coefficient r between two series."""
    n = min(len(series_a), len(series_b))
    if n < 3:
        return 0.0

    a = series_a[-n:]
    b = series_b[-n:]

    mean_a = sum(a) / n
    mean_b = sum(b) / n

    numerator = sum((a[i] - mean_a) * (b[i] - mean_b) for i in range(n))
    denom_a = math.sqrt(sum((a[i] - mean_a) ** 2 for i in range(n)))
    denom_b = math.sqrt(sum((b[i] - mean_b) ** 2 for i in range(n)))

    if denom_a == 0 or denom_b == 0:
        return 0.0

    r = numerator / (denom_a * denom_b)
    return round(max(-1.0, min(1.0, r)), 4)


class CorrelationService:
    """Calculates cross-asset correlations across daily returns."""

    def __init__(self, market_data):
        self.market_data = market_data

    def _normalize_symbol(self, symbol: str) -> str:
        return self.market_data.normalize_symbol(symbol)

    def _get_candles(self, symbol: str, period: str) -> tuple[str, list[dict[str, Any]]]:
        if hasattr(self.market_data, "get_candles"):
            return self.market_data.get_candles(symbol, period=period, interval="1d")
        normalized = self.market_data.normalize_symbol(symbol)
        return normalized, self.market_data.get_ohlc(normalized, period=period, interval="1d")

    def _get_return_series(self, symbol: str, period: str = "6mo") -> tuple[list[str], list[float]]:
        _, candles = self._get_candles(symbol, period)
        if len(candles) < 2:
            return [], []

        times = [c["time"] for c in candles[1:]]
        # Calculate daily percentage returns
        returns = [
            (candles[i]["close"] - candles[i - 1]["close"]) / candles[i - 1]["close"]
            for i in range(1, len(candles))
        ]
        return times, returns

    def compute_pairwise(self, symbol_a: str, symbol_b: str, window: int = 20) -> dict[str, Any]:
        sym_a = self._normalize_symbol(symbol_a)
        sym_b = self._normalize_symbol(symbol_b)

        times_a, returns_a = self._get_return_series(sym_a, period="1y")
        times_b, returns_b = self._get_return_series(sym_b, period="1y")

        # Map by date to align timestamps
        map_a = dict(zip(times_a, returns_a))
        map_b = dict(zip(times_b, returns_b))

        common_dates = sorted(set(map_a.keys()).intersection(set(map_b.keys())))
        if len(common_dates) < window:
            return {
                "symbol_a": sym_a,
                "symbol_b": sym_b,
                "window": window,
                "overall_correlation": 0.0,
                "rolling_series": [],
                "disclaimer": "Correlation does not imply causation. Insufficient common data points.",
            }

        aligned_a = [map_a[d] for d in common_dates]
        aligned_b = [map_b[d] for d in common_dates]

        # Overall correlation over window
        overall_r = compute_pearson_correlation(aligned_a[-window:], aligned_b[-window:])

        # Rolling series over time
        rolling_series = []
        for i in range(window, len(common_dates) + 1):
            sub_a = aligned_a[i - window : i]
            sub_b = aligned_b[i - window : i]
            r = compute_pearson_correlation(sub_a, sub_b)
            rolling_series.append({"time": common_dates[i - 1], "correlation": r})

        return {
            "symbol_a": sym_a,
            "symbol_b": sym_b,
            "window": window,
            "common_data_points": len(common_dates),
            "overall_correlation": overall_r,
            "rolling_series": rolling_series,
            "disclaimer": "Empirical observation only. Correlation does not imply causation or direct financial transmission.",
        }

    def compute_matrix(self, symbols: list[str], window: int = 20) -> dict[str, Any]:
        norm_symbols = [self._normalize_symbol(s) for s in symbols]
        matrix: dict[str, dict[str, float]] = {}

        # Cache returns
        returns_cache = {}
        dates_cache = {}
        for s in norm_symbols:
            t, r = self._get_return_series(s, period="1y")
            dates_cache[s] = t
            returns_cache[s] = dict(zip(t, r))

        for s1 in norm_symbols:
            matrix[s1] = {}
            for s2 in norm_symbols:
                if s1 == s2:
                    matrix[s1][s2] = 1.0
                else:
                    common = sorted(set(returns_cache[s1].keys()).intersection(set(returns_cache[s2].keys())))
                    if len(common) >= window:
                        a1 = [returns_cache[s1][d] for d in common[-window:]]
                        a2 = [returns_cache[s2][d] for d in common[-window:]]
                        matrix[s1][s2] = compute_pearson_correlation(a1, a2)
                    else:
                        matrix[s1][s2] = 0.0

        return {
            "window": window,
            "symbols": norm_symbols,
            "matrix": matrix,
            "disclaimer": "Correlation does not imply causation.",
        }
