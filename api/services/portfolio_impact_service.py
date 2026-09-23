"""Explain the effect of a candidate cash-equity position on a portfolio."""

from collections import defaultdict
from decimal import Decimal
from typing import Any

from api.services.portfolio_risk_service import PortfolioRiskService


class PortfolioImpactService:
    VERSION = "PORTFOLIO-IMPACT-V1"

    def __init__(self, market_data):
        self.market_data = market_data

    @staticmethod
    def d(value: Any) -> Decimal:
        return Decimal(str(value))

    def build(self, snapshot, policy, *, symbol, quantity, entry_price, invalidation_price) -> dict[str, Any]:
        candidate_value = self.d(quantity) * self.d(entry_price)
        projected_total = self.d(snapshot.total_value) + candidate_value
        existing = next((holding for holding in snapshot.holdings if holding.symbol == symbol), None)
        current_symbol_value = self.d(existing.market_value) if existing else Decimal(0)
        current_symbol_exposure = current_symbol_value / self.d(snapshot.total_value) if snapshot.total_value else Decimal(0)
        projected_symbol_exposure = (current_symbol_value + candidate_value) / projected_total if projected_total else Decimal(0)
        catalogue = {item["symbol"]: item for item in self.market_data.get_stocks()}
        sector = catalogue.get(symbol, {}).get("sector", "Unclassified")
        sectors: dict[str, Decimal] = defaultdict(Decimal)
        for holding in snapshot.holdings:
            sectors[holding.sector] += self.d(holding.market_value)
        current_sector = sectors[sector] / self.d(snapshot.total_value) if snapshot.total_value else Decimal(0)
        projected_sector = (sectors[sector] + candidate_value) / projected_total if projected_total else Decimal(0)
        loss_at_invalidation = self.d(quantity) * (self.d(entry_price) - self.d(invalidation_price))
        planned_loss_pct = loss_at_invalidation / self.d(snapshot.total_value) * Decimal(100) if snapshot.total_value else Decimal(0)
        warnings = []
        if projected_symbol_exposure * Decimal(100) > self.d(policy.max_single_stock_pct):
            warnings.append(self._warning("SINGLE_POSITION_LIMIT_EXCEEDED", projected_symbol_exposure * Decimal(100), policy.max_single_stock_pct, symbol))
        if projected_sector * Decimal(100) > self.d(policy.max_sector_pct):
            warnings.append(self._warning("SECTOR_LIMIT_EXCEEDED", projected_sector * Decimal(100), policy.max_sector_pct, sector))
        if planned_loss_pct > self.d(policy.max_planned_loss_pct):
            warnings.append(self._warning("OPEN_RISK_BUDGET_EXCEEDED", planned_loss_pct, policy.max_planned_loss_pct, symbol))
        risk = PortfolioRiskService(self.market_data).build(snapshot, int(policy.minimum_observations))
        maximum_correlation = None
        correlated_symbol = None
        if risk.get("data_quality") in {"COMPLETE", "PARTIAL"} and symbol in risk.get("symbols", []):
            index = risk["symbols"].index(symbol)
            peers = [(risk["symbols"][peer], risk["correlation_matrix"][index][peer]) for peer in range(len(risk["symbols"])) if peer != index]
            if peers:
                correlated_symbol, maximum_correlation = max(peers, key=lambda item: item[1])
                if maximum_correlation > float(policy.correlation_warning):
                    warnings.append(self._warning("HIGH_EXISTING_CORRELATION", maximum_correlation, policy.correlation_warning, correlated_symbol))
        elif snapshot.holdings:
            maximum_correlation, correlated_symbol = self._candidate_correlation(
                symbol, snapshot.holdings, int(policy.minimum_observations)
            )
            if maximum_correlation is not None and maximum_correlation > float(policy.correlation_warning):
                warnings.append(self._warning("HIGH_EXISTING_CORRELATION", maximum_correlation, policy.correlation_warning, correlated_symbol))
        return {
            "formula_version": self.VERSION,
            "portfolio_snapshot_id": snapshot.id,
            "risk_policy_version": policy.version,
            "symbol": symbol,
            "sector": sector,
            "current_symbol_exposure_pct": float(current_symbol_exposure * Decimal(100)),
            "projected_symbol_exposure_pct": float(projected_symbol_exposure * Decimal(100)),
            "current_sector_exposure_pct": float(current_sector * Decimal(100)),
            "projected_sector_exposure_pct": float(projected_sector * Decimal(100)),
            "loss_at_invalidation": float(loss_at_invalidation),
            "planned_loss_pct": float(planned_loss_pct),
            "maximum_existing_correlation": maximum_correlation,
            "most_correlated_symbol": correlated_symbol,
            "risk_data_quality": risk.get("data_quality"),
            "warnings": warnings,
        }

    def _candidate_correlation(self, symbol, holdings, minimum_observations):
        try:
            _, candidate_candles = self.market_data.get_candles(symbol, period="1y", interval="1d")
            candidate = PortfolioRiskService.returns(candidate_candles)
        except Exception:
            return None, None
        correlations = []
        for holding in holdings:
            if holding.symbol == symbol:
                continue
            try:
                _, candles = self.market_data.get_candles(holding.symbol, period="1y", interval="1d")
                existing = PortfolioRiskService.returns(candles)
            except Exception:
                continue
            dates = sorted(set(candidate) & set(existing))
            if len(dates) < minimum_observations:
                continue
            left = [candidate[item] for item in dates]
            right = [existing[item] for item in dates]
            covariance = PortfolioRiskService.covariance(left, right)
            left_variance = PortfolioRiskService.covariance(left, left)
            right_variance = PortfolioRiskService.covariance(right, right)
            denominator = (left_variance * right_variance) ** 0.5
            correlations.append((holding.symbol, covariance / denominator if denominator else 0.0))
        if not correlations:
            return None, None
        correlated_symbol, maximum = max(correlations, key=lambda item: item[1])
        return maximum, correlated_symbol

    @staticmethod
    def _warning(code, actual, threshold, subject):
        return {
            "code": code,
            "actual": float(actual),
            "threshold": float(threshold),
            "subject": subject,
            "advisory": True,
        }
