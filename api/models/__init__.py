"""
models/__init__.py
──────────────────
Import all ORM models so SQLAlchemy's metadata is fully populated
before Base.metadata.create_all() is called at startup.
"""

from api.models.stock import Stock, DailyCandle
from api.models.user import User, UserRole
from api.models.watchlist import Watchlist, WatchlistItem
from api.models.portfolio import Portfolio, Holding, PortfolioTransaction
from api.models.alert import Alert
from api.models.intelligence import ChartAnnotation, DecisionJournalEntry, DecisionTicketAmendment
from api.models.portfolio_intelligence import PortfolioRiskPolicy, PortfolioSnapshot, PortfolioSnapshotHolding
from api.models.replay_lab import ReplayExecution, ReplaySession, ReplaySessionEvent, ReplaySessionResult

__all__ = [
    "Stock",
    "DailyCandle",
    "User",
    "UserRole",
    "Watchlist",
    "WatchlistItem",
    "Portfolio",
    "Holding",
    "PortfolioTransaction",
    "Alert",
    "ChartAnnotation",
    "DecisionJournalEntry",
    "DecisionTicketAmendment",
    "ReplaySession",
    "ReplaySessionEvent",
    "ReplayExecution",
    "ReplaySessionResult",
    "PortfolioSnapshot",
    "PortfolioSnapshotHolding",
    "PortfolioRiskPolicy",
]
