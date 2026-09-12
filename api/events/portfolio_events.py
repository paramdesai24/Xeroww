"""
api/events/portfolio_events.py
──────────────────────────────
Domain events for the Portfolio and Simulated Trading aggregate.
Represents paper trade executions, cash movements, and portfolio creation.
"""

from dataclasses import dataclass
from typing import Any
from api.events.base import DomainEvent


@dataclass(frozen=True)
class PortfolioCreated(DomainEvent):
    """Fired when a new simulated trading portfolio is created."""

    @classmethod
    def create(
        cls,
        portfolio_id: int,
        name: str,
        user_id: int,
        initial_cash: float,
        metadata: dict[str, Any] | None = None,
    ) -> "PortfolioCreated":
        payload = {
            "portfolio_id": portfolio_id,
            "name": name,
            "user_id": user_id,
            "initial_cash": initial_cash,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="portfolio.created",
            aggregate_id=f"portfolio:{portfolio_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class AssetBought(DomainEvent):
    """Fired when a BUY paper order is successfully executed."""

    @classmethod
    def create(
        cls,
        portfolio_id: int,
        symbol: str,
        quantity: float,
        price: float,
        total_cost: float,
        user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> "AssetBought":
        payload = {
            "portfolio_id": portfolio_id,
            "symbol": symbol.upper(),
            "quantity": quantity,
            "price": price,
            "total_cost": total_cost,
            "user_id": user_id,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="portfolio.asset_bought",
            aggregate_id=f"portfolio:{portfolio_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class AssetSold(DomainEvent):
    """Fired when a SELL paper order is successfully executed."""

    @classmethod
    def create(
        cls,
        portfolio_id: int,
        symbol: str,
        quantity: float,
        price: float,
        proceeds: float,
        realized_pnl: float,
        user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> "AssetSold":
        payload = {
            "portfolio_id": portfolio_id,
            "symbol": symbol.upper(),
            "quantity": quantity,
            "price": price,
            "proceeds": proceeds,
            "realized_pnl": realized_pnl,
            "user_id": user_id,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="portfolio.asset_sold",
            aggregate_id=f"portfolio:{portfolio_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class PortfolioUpdated(DomainEvent):
    """Fired when portfolio balances or holdings change outside direct trade executions."""

    @classmethod
    def create(
        cls,
        portfolio_id: int,
        cash_balance: float,
        user_id: int,
        reason: str = "balance_sync",
        metadata: dict[str, Any] | None = None,
    ) -> "PortfolioUpdated":
        payload = {
            "portfolio_id": portfolio_id,
            "cash_balance": cash_balance,
            "user_id": user_id,
            "reason": reason,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="portfolio.updated",
            aggregate_id=f"portfolio:{portfolio_id}",
            payload=payload,
            metadata=meta,
        )
