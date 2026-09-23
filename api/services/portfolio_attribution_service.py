"""Explainable return and P&L attribution over observed portfolio snapshots."""

from collections import defaultdict
from typing import Any


class PortfolioAttributionService:
    VERSION = "PORTFOLIO-ATTRIBUTION-V1"

    @classmethod
    def build(cls, snapshots) -> dict[str, Any]:
        ordered = sorted(snapshots, key=lambda item: item.as_of)
        if not ordered:
            return {"data_quality": "INSUFFICIENT", "holdings": [], "sectors": [], "limitations": ["No snapshots are available."]}
        first = ordered[0]
        last = ordered[-1]
        first_holdings = {holding.symbol: holding for holding in first.holdings}
        last_holdings = {holding.symbol: holding for holding in last.holdings}
        total_start = float(first.total_value)
        contributions = []
        sector_totals: dict[str, float] = defaultdict(float)
        for symbol in sorted(set(first_holdings) | set(last_holdings)):
            before = first_holdings.get(symbol)
            after = last_holdings.get(symbol)
            start_value = float(before.market_value) if before else 0.0
            end_value = float(after.market_value) if after else 0.0
            pnl = end_value - start_value
            contribution = pnl / total_start if total_start > 0 else 0.0
            sector = (after or before).sector
            sector_totals[sector] += contribution
            contributions.append({
                "symbol": symbol,
                "sector": sector,
                "start_value": start_value,
                "end_value": end_value,
                "pnl_change": pnl,
                "return_contribution": contribution,
                "formula_version": cls.VERSION,
            })
        cash_effect = (float(last.cash) - float(first.cash)) / total_start if total_start > 0 else 0.0
        observed_return = float(last.total_value) / total_start - 1 if total_start > 0 else 0.0
        explained = sum(item["return_contribution"] for item in contributions) + cash_effect
        return {
            "data_quality": "COMPLETE" if len(ordered) >= 2 else "INSUFFICIENT",
            "observation_count": len(ordered),
            "holdings": sorted(contributions, key=lambda item: item["return_contribution"], reverse=True),
            "sectors": [
                {"sector": sector, "return_contribution": value}
                for sector, value in sorted(sector_totals.items(), key=lambda item: item[1], reverse=True)
            ],
            "cash_effect": cash_effect,
            "realized_pnl": float(last.realized_pnl_to_date),
            "unrealized_pnl": float(last.unrealized_pnl),
            "observed_return": observed_return,
            "reconciliation_residual": observed_return - explained,
            "formula_version": cls.VERSION,
            "limitations": ["Attribution uses observed snapshots and exposes trading and timing effects as residual."],
        }

