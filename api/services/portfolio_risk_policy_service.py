"""Tenant-scoped portfolio risk policy management."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from api.models.portfolio import Portfolio
from api.models.portfolio_intelligence import PortfolioRiskPolicy


class PortfolioRiskPolicyService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def get(self, portfolio_id: int) -> PortfolioRiskPolicy:
        portfolio = self.db.query(Portfolio).filter(
            Portfolio.id == portfolio_id, Portfolio.user_id == self.user_id
        ).first()
        if not portfolio:
            raise HTTPException(status_code=404, detail={"code": "PORTFOLIO_NOT_FOUND", "message": "Portfolio was not found."})
        policy = self.db.query(PortfolioRiskPolicy).filter(
            PortfolioRiskPolicy.portfolio_id == portfolio_id,
            PortfolioRiskPolicy.user_id == self.user_id,
        ).first()
        if not policy:
            policy = PortfolioRiskPolicy(portfolio_id=portfolio_id, user_id=self.user_id)
            self.db.add(policy)
            self.db.commit()
            self.db.refresh(policy)
        return policy

    def update(self, portfolio_id: int, data) -> PortfolioRiskPolicy:
        policy = self.get(portfolio_id)
        if policy.version != data.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "PORTFOLIO_CONTEXT_CHANGED", "message": "The risk policy changed. Reload before saving."},
            )
        for field in (
            "max_single_stock_pct", "max_sector_pct", "max_planned_loss_pct",
            "max_total_open_risk_pct", "correlation_warning", "drawdown_review_pct",
            "minimum_observations",
        ):
            setattr(policy, field, getattr(data, field))
        policy.version += 1
        self.db.commit()
        self.db.refresh(policy)
        try:
            from api.events import PortfolioIntelligenceEvent, get_event_bus
            get_event_bus().publish(PortfolioIntelligenceEvent.create(
                "risk_policy_changed",
                portfolio_id,
                self.user_id,
                {"policy_version": policy.version},
            ))
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Risk policy event publication failed after commit")
        return policy
