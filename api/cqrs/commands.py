"""
api/cqrs/commands.py
────────────────────
Command models for the Command-Query Responsibility Segregation (CQRS) layer.

Commands encapsulate explicit intent to mutate state.
In distributed architectures, Commands are dispatched through a CommandBus or Kafka topic.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import uuid


@dataclass(frozen=True, kw_only=True)
class Command:
    """Base Command with tracing and correlation IDs."""
    command_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True, kw_only=True)
class CreatePortfolio(Command):
    name: str
    user_id: int
    initial_cash: float | None = None


@dataclass(frozen=True, kw_only=True)
class BuyAsset(Command):
    portfolio_id: int
    symbol: str
    quantity: float
    user_id: int
    limit_price: float | None = None


@dataclass(frozen=True, kw_only=True)
class SellAsset(Command):
    portfolio_id: int
    symbol: str
    quantity: float
    user_id: int
    limit_price: float | None = None


@dataclass(frozen=True, kw_only=True)
class CreateAlert(Command):
    symbol: str
    alert_type: str
    condition_payload: dict[str, Any]
    user_id: int


@dataclass(frozen=True, kw_only=True)
class DeleteAlert(Command):
    alert_id: int
    user_id: int


@dataclass(frozen=True, kw_only=True)
class EvaluateAlert(Command):
    alert_id: int
    user_id: int


@dataclass(frozen=True, kw_only=True)
class CreateJournalEntry(Command):
    symbol: str
    thesis: str
    user_id: int
    entry_type: str | None = None
    confidence: int | None = None


@dataclass(frozen=True, kw_only=True)
class UpdateJournalEntry(Command):
    entry_id: int
    user_id: int
    review_notes: str | None = None
    outcome: str | None = None
