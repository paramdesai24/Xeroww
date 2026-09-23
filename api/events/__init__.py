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
from api.events.journal_events import (
    JournalEntryCreated,
    JournalEntryReviewed,
    JournalEntryUpdated,
)
from api.events.alert_events import (
    AlertCreated,
    AlertTriggered,
    AlertEvaluated,
    AlertDeleted,
)
from api.events.decision_events import DecisionTicketEvent
from api.events.replay_lab_events import ReplayLabEvent
from api.events.portfolio_intelligence_events import PortfolioIntelligenceEvent
from api.events.bus import (
    EventBus,
    InMemoryEventBus,
    get_event_bus,
    set_event_bus,
)
from api.events.handlers import register_default_handlers

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
    "JournalEntryCreated",
    "JournalEntryReviewed",
    "JournalEntryUpdated",
    "AlertCreated",
    "AlertTriggered",
    "AlertEvaluated",
    "AlertDeleted",
    "DecisionTicketEvent",
    "ReplayLabEvent",
    "PortfolioIntelligenceEvent",
    "EventBus",
    "InMemoryEventBus",
    "get_event_bus",
    "set_event_bus",
    "register_default_handlers",
]






