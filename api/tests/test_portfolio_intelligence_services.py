"""Known-vector tests for Portfolio Intelligence calculations."""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from api.services.portfolio_performance_service import PortfolioPerformanceService
from api.services.portfolio_risk_service import PortfolioRiskService


def snapshots(values):
    start = datetime(2026, 1, 1)
    return [
        SimpleNamespace(
            as_of=start + timedelta(days=index),
            total_value=value,
            benchmark_close=100 + index,
        )
        for index, value in enumerate(values)
    ]


def test_drawdown_uses_peak_that_precedes_the_trough():
    result = PortfolioPerformanceService.build(snapshots([100, 120, 90, 95, 121]))
    assert result["maximum_drawdown"]["result"] == pytest.approx(-0.25)
    assert result["drawdown_recovery"]["peak_at"].startswith("2026-01-02")
    assert result["drawdown_recovery"]["trough_at"].startswith("2026-01-03")
    assert result["drawdown_recovery"]["recovery_periods"] == 2


def test_covariance_matches_known_sample_vector():
    left = [1.0, 2.0, 3.0]
    right = [2.0, 4.0, 6.0]
    assert PortfolioRiskService.covariance(left, right) == pytest.approx(2.0)


def test_single_snapshot_is_explicitly_insufficient():
    result = PortfolioPerformanceService.build(snapshots([100]))
    assert result["absolute_return"]["data_quality"] == "INSUFFICIENT"
    assert result["annualized_volatility"]["result"] is None

