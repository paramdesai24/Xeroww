"""
api/cqrs/queries.py
───────────────────
Query models for the Command-Query Responsibility Segregation (CQRS) layer.

Queries represent side-effect-free data retrieval requests.
Prepared for routing to read replicas, query-side projections, and materialized views.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid


@dataclass(frozen=True, kw_only=True)
class Query:
    """Base Query with request correlation metadata."""
    query_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True, kw_only=True)
class GetPortfolio(Query):
    portfolio_id: int
    user_id: int


@dataclass(frozen=True, kw_only=True)
class GetPortfolioList(Query):
    user_id: int


@dataclass(frozen=True, kw_only=True)
class GetReplayState(Query):
    symbol: str
    step_index: int | None = None


@dataclass(frozen=True, kw_only=True)
class GetMarketSnapshot(Query):
    symbol: str


@dataclass(frozen=True, kw_only=True)
class GetAlertList(Query):
    user_id: int
    skip: int = 0
    limit: int = 50


@dataclass(frozen=True, kw_only=True)
class GetJournalEntries(Query):
    user_id: int
    skip: int = 0
    limit: int = 50
