"""Application facade for Portfolio Intelligence projections."""

from collections import deque
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from api.models.portfolio import PortfolioTransaction, TradeSide
from api.models.portfolio_intelligence import PortfolioSnapshot
from api.services.portfolio_attribution_service import PortfolioAttributionService
from api.services.portfolio_performance_service import PortfolioPerformanceService
from api.services.portfolio_risk_policy_service import PortfolioRiskPolicyService
from api.services.portfolio_risk_service import PortfolioRiskService
from api.services.portfolio_valuation_service import PortfolioValuationService


class PortfolioIntelligenceService:
    def __init__(self, db: Session, user_id: int, market_data):
        self.db = db
        self.user_id = user_id
        self.market_data = market_data
        self.valuations = PortfolioValuationService(db, user_id, market_data)
        self.policies = PortfolioRiskPolicyService(db, user_id)

    def snapshots(self, portfolio_id: int) -> list[PortfolioSnapshot]:
        self.valuations.portfolio(portfolio_id)
        return (
            self.db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.portfolio_id == portfolio_id, PortfolioSnapshot.user_id == self.user_id)
            .order_by(PortfolioSnapshot.as_of.asc())
            .all()
        )

    def performance(self, portfolio_id: int) -> dict[str, Any]:
        snapshots = self.snapshots(portfolio_id)
        metrics = PortfolioPerformanceService.build(snapshots)
        transactions = (
            self.db.query(PortfolioTransaction)
            .filter(PortfolioTransaction.portfolio_id == portfolio_id)
            .order_by(PortfolioTransaction.timestamp.asc())
            .all()
        )
        average_value = mean(float(item.total_value) for item in snapshots) if snapshots else 0.0
        traded = sum(abs(float(item.quantity) * float(item.execution_price)) for item in transactions)
        metrics["turnover"] = {
            "formula_id": "absolute-trade-value-over-average-nav",
            "formula_version": PortfolioPerformanceService.VERSION,
            "result": traded / average_value if average_value else None,
            "unit": "ratio",
            "observation_count": len(transactions),
            "data_quality": "COMPLETE" if average_value else "INSUFFICIENT",
            "limitations": [],
        }
        metrics["average_holding_period"] = self._holding_period(transactions)
        metrics["cash_drag"] = self._cash_drag(snapshots)
        return {
            "portfolio_id": portfolio_id,
            "latest_snapshot_id": snapshots[-1].id if snapshots else None,
            "data_quality": {"state": "COMPLETE" if len(snapshots) >= 2 else "INSUFFICIENT"},
            "metrics": {key: value for key, value in metrics.items() if key != "series"},
            "series": metrics.get("series", {}),
            "warnings": [],
        }

    def attribution(self, portfolio_id: int) -> dict[str, Any]:
        snapshots = self.snapshots(portfolio_id)
        result = PortfolioAttributionService.build(snapshots)
        return {
            "portfolio_id": portfolio_id,
            "latest_snapshot_id": snapshots[-1].id if snapshots else None,
            "data_quality": {"state": result.get("data_quality", "INSUFFICIENT")},
            "metrics": result,
            "series": {},
            "warnings": [],
        }

    def risk(self, portfolio_id: int) -> dict[str, Any]:
        latest = self.valuations.latest(portfolio_id)
        policy = self.policies.get(portfolio_id)
        result = PortfolioRiskService(self.market_data).build(latest, int(policy.minimum_observations)) if latest else {
            "data_quality": "INSUFFICIENT", "warnings": [], "limitations": ["No snapshot is available."]
        }
        warnings = list(result.get("warnings", []))
        concentration = result.get("concentration", {})
        largest = concentration.get("largest_holding")
        if largest and float(largest[1]) * 100 > float(policy.max_single_stock_pct):
            warnings.append({
                "code": "SINGLE_POSITION_LIMIT_EXCEEDED",
                "subject": largest[0],
                "actual": float(largest[1]) * 100,
                "threshold": float(policy.max_single_stock_pct),
                "advisory": True,
            })
        for sector, weight in concentration.get("sector_weights", {}).items():
            if float(weight) * 100 > float(policy.max_sector_pct):
                warnings.append({
                    "code": "SECTOR_LIMIT_EXCEEDED",
                    "subject": sector,
                    "actual": float(weight) * 100,
                    "threshold": float(policy.max_sector_pct),
                    "advisory": True,
                })
        return {
            "portfolio_id": portfolio_id,
            "latest_snapshot_id": latest.id if latest else None,
            "data_quality": {"state": result.get("data_quality", "INSUFFICIENT")},
            "metrics": result,
            "series": {},
            "warnings": warnings,
        }

    @staticmethod
    def _holding_period(transactions) -> dict[str, Any]:
        lots: dict[str, deque] = {}
        weighted_days = 0.0
        closed_quantity = 0.0
        for transaction in transactions:
            queue = lots.setdefault(transaction.symbol, deque())
            if transaction.side == TradeSide.BUY:
                queue.append([float(transaction.quantity), transaction.timestamp])
                continue
            remaining = float(transaction.quantity)
            while remaining > 0 and queue:
                available, opened_at = queue[0]
                matched = min(available, remaining)
                weighted_days += max(0.0, (transaction.timestamp - opened_at).total_seconds() / 86400) * matched
                closed_quantity += matched
                available -= matched
                remaining -= matched
                if available <= 0:
                    queue.popleft()
                else:
                    queue[0][0] = available
        return {
            "formula_id": "fifo-quantity-weighted-holding-days",
            "formula_version": PortfolioPerformanceService.VERSION,
            "result": weighted_days / closed_quantity if closed_quantity else None,
            "unit": "days",
            "observation_count": len(transactions),
            "data_quality": "COMPLETE" if closed_quantity else "INSUFFICIENT",
            "limitations": ["FIFO is used for duration only. Portfolio P&L continues to use weighted average cost."],
        }

    @staticmethod
    def _cash_drag(snapshots) -> dict[str, Any]:
        ordered = sorted(snapshots, key=lambda item: item.as_of)
        drag = 0.0
        observations = 0
        for previous, current in zip(ordered, ordered[1:]):
            if previous.benchmark_close and current.benchmark_close and previous.total_value:
                benchmark_return = float(current.benchmark_close) / float(previous.benchmark_close) - 1
                cash_weight = float(previous.cash) / float(previous.total_value)
                drag += -cash_weight * benchmark_return
                observations += 1
        return {
            "formula_id": "benchmark-relative-cash-drag",
            "formula_version": PortfolioPerformanceService.VERSION,
            "result": drag if observations else None,
            "unit": "return-contribution",
            "observation_count": observations,
            "data_quality": "COMPLETE" if observations else "INSUFFICIENT",
            "limitations": ["Cash return is assumed to be zero."],
        }

