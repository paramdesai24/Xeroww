"""
api/cqrs
────────
Command-Query Responsibility Segregation (CQRS) Architecture.

Separates operations that mutate state (Commands) from operations that read state (Queries).
Prepares the platform for event-driven message queues and read/write replica scaling.
"""

from api.cqrs.commands import (
    Command,
    CreatePortfolio,
    BuyAsset,
    SellAsset,
    CreateAlert,
    DeleteAlert,
    EvaluateAlert,
    CreateJournalEntry,
    UpdateJournalEntry,
)
from api.cqrs.queries import (
    Query,
    GetPortfolio,
    GetPortfolioList,
    GetReplayState,
    GetMarketSnapshot,
    GetAlertList,
    GetJournalEntries,
)
from api.cqrs.handlers import (
    CommandHandler,
    QueryHandler,
    CommandBus,
    QueryBus,
)

__all__ = [
    "Command",
    "CreatePortfolio",
    "BuyAsset",
    "SellAsset",
    "CreateAlert",
    "DeleteAlert",
    "EvaluateAlert",
    "CreateJournalEntry",
    "UpdateJournalEntry",
    "Query",
    "GetPortfolio",
    "GetPortfolioList",
    "GetReplayState",
    "GetMarketSnapshot",
    "GetAlertList",
    "GetJournalEntries",
    "CommandHandler",
    "QueryHandler",
    "CommandBus",
    "QueryBus",
]

