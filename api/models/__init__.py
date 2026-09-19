"""
models/__init__.py
──────────────────
Import all ORM models so SQLAlchemy's metadata is fully populated
before Base.metadata.create_all() is called at startup.
"""

from api.models.stock import Stock, DailyCandle  # V0.5 market models (preserved)
from api.models.user import User, UserRole
from api.models.watchlist import Watchlist, WatchlistItem
from api.models.portfolio import Portfolio, Holding, PortfolioTransaction
from api.models.alert import Alert
from api.models.intelligence import ChartAnnotation, DecisionJournalEntry, DecisionTicketAmendment

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
]
