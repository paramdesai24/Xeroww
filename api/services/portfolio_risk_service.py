"""Deterministic portfolio concentration, covariance, beta, and risk contribution."""

import math
from collections import defaultdict
from statistics import mean
from typing import Any


class PortfolioRiskService:
    VERSION = "PORTFOLIO-RISK-V1"

    def __init__(self, market_data):
        self.market_data = market_data

    @staticmethod
    def returns(candles: list[dict[str, Any]]) -> dict[str, float]:
        ordered = sorted(candles, key=lambda item: str(item["time"]))
        return {
            str(ordered[index]["time"]): float(ordered[index]["close"]) / float(ordered[index - 1]["close"]) - 1
            for index in range(1, len(ordered))
            if float(ordered[index - 1]["close"]) > 0
        }

    @staticmethod
    def covariance(left: list[float], right: list[float]) -> float:
        if len(left) < 2 or len(left) != len(right):
            raise ValueError("Covariance requires at least two aligned observations.")
        left_mean = mean(left)
        right_mean = mean(right)
        return sum((a - left_mean) * (b - right_mean) for a, b in zip(left, right)) / (len(left) - 1)

    def build(self, snapshot, minimum_observations: int) -> dict[str, Any]:
        holdings = list(snapshot.holdings)
        if not holdings:
            return {"data_quality": "INSUFFICIENT", "warnings": [], "limitations": ["The portfolio has no valued holdings."]}
        series: dict[str, dict[str, float]] = {}
        missing = []
        for holding in holdings:
            try:
                _, candles = self.market_data.get_candles(holding.symbol, period="1y", interval="1d")
                series[holding.symbol] = self.returns(candles)
            except Exception:
                missing.append(holding.symbol)
        try:
            benchmark_series = self.returns(self.market_data.get_benchmark_candles("^NSEI", period="1y", interval="1d"))
        except Exception:
            benchmark_series = {}
        if not series:
            return {"data_quality": "INSUFFICIENT", "missing_symbols": missing, "warnings": [], "limitations": ["No holding return series are available."]}

        common_dates = set.intersection(*(set(values) for values in series.values()))
        common_dates &= set(benchmark_series) if benchmark_series else common_dates
        dates = sorted(common_dates)
        if len(dates) < minimum_observations:
            return {
                "data_quality": "INSUFFICIENT",
                "observation_count": len(dates),
                "missing_symbols": missing,
                "warnings": [],
                "limitations": [f"At least {minimum_observations} aligned observations are required."],
            }
        symbols = sorted(series)
        aligned = {symbol: [series[symbol][date] for date in dates] for symbol in symbols}
        covariance = [
            [self.covariance(aligned[left], aligned[right]) for right in symbols]
            for left in symbols
        ]
        correlation = []
        for i, left in enumerate(symbols):
            row = []
            for j, right in enumerate(symbols):
                denom = math.sqrt(covariance[i][i] * covariance[j][j])
                row.append(covariance[i][j] / denom if denom else 0.0)
            correlation.append(row)
        weights_by_symbol = {holding.symbol: float(holding.portfolio_weight) for holding in holdings}
        weights = [weights_by_symbol[symbol] for symbol in symbols]
        marginal_numerator = [sum(covariance[i][j] * weights[j] for j in range(len(symbols))) for i in range(len(symbols))]
        variance = sum(weights[i] * marginal_numerator[i] for i in range(len(symbols)))
        daily_volatility = math.sqrt(max(variance, 0.0))
        annualized = daily_volatility * math.sqrt(252)
        contributions = []
        for index, symbol in enumerate(symbols):
            component = weights[index] * marginal_numerator[index] / daily_volatility if daily_volatility else 0.0
            contributions.append({
                "symbol": symbol,
                "weight": weights[index],
                "component_volatility": component * math.sqrt(252),
                "percent_risk_contribution": component / daily_volatility if daily_volatility else None,
            })
        portfolio_returns = [sum(weights[i] * aligned[symbol][row] for i, symbol in enumerate(symbols)) for row in range(len(dates))]
        benchmark_values = [benchmark_series[date] for date in dates] if benchmark_series else []
        beta = None
        if benchmark_values:
            benchmark_variance = self.covariance(benchmark_values, benchmark_values)
            beta = self.covariance(portfolio_returns, benchmark_values) / benchmark_variance if benchmark_variance else None
        sectors: dict[str, float] = defaultdict(float)
        for holding in holdings:
            sectors[holding.sector] += float(holding.portfolio_weight)
        hhi = sum(weight * weight for weight in weights_by_symbol.values())
        return {
            "data_quality": "PARTIAL" if missing else "COMPLETE",
            "formula_version": self.VERSION,
            "observation_start": dates[0],
            "observation_end": dates[-1],
            "observation_count": len(dates),
            "symbols": symbols,
            "covariance_matrix": covariance,
            "correlation_matrix": correlation,
            "annualized_portfolio_volatility": annualized,
            "portfolio_beta": beta,
            "risk_contributions": contributions,
            "concentration": {
                "largest_holding": max(weights_by_symbol.items(), key=lambda item: item[1]),
                "top_three_weight": sum(sorted(weights_by_symbol.values(), reverse=True)[:3]),
                "sector_weights": dict(sorted(sectors.items())),
                "hhi": hhi,
            },
            "missing_symbols": missing,
            "limitations": ["Uses adjusted daily closes over the common timestamp intersection."],
        }

