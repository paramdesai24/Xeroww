"""Bounded integration events for Portfolio Intelligence."""

from dataclasses import dataclass
from typing import Any

from api.events.base import DomainEvent


@dataclass(frozen=True)
class PortfolioIntelligenceEvent(DomainEvent):
    @classmethod
    def create(
        cls,
        action: str,
        portfolio_id: int,
        user_id: int,
        payload: dict[str, Any] | None = None,
    ) -> "PortfolioIntelligenceEvent":
        return cls(
            event_type=f"portfolio.{action}",
            aggregate_id=f"portfolio:{portfolio_id}",
            payload={"portfolio_id": portfolio_id, **(payload or {})},
            metadata={"user_id": user_id},
        )
