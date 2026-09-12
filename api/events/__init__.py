"""
api/events
──────────
Domain Events and In-Memory Event Bus.

Decouples side-effects and cross-domain communication across Xeroww.
Provides a drop-in replacement seam for Apache Kafka / Redis Streams in distributed deployments.
"""

from api.events.base import DomainEvent
from api.events.market_events import (
    MarketSnapshotReceived,
    PatternDetected,
    RegimeChanged,
    SupportResistanceBroken,
)
from api.events.portfolio_events import (
    PortfolioCreated,
    AssetBought,
    AssetSold,
    PortfolioUpdated,
)

__all__ = [
    "DomainEvent",
    "MarketSnapshotReceived",
    "PatternDetected",
    "RegimeChanged",
    "SupportResistanceBroken",
    "PortfolioCreated",
    "AssetBought",
    "AssetSold",
    "PortfolioUpdated",
]


