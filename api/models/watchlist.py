"""
models/watchlist.py
───────────────────
Watchlist domain models for Xeroww multi-tenant platform.

A user can have multiple named watchlists. One is marked as default.
WatchlistItems store only the symbol string — market data is NEVER duplicated here.
"""

from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database.session import Base


class Watchlist(Base):
    """Named watchlist owned by a single user."""
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="watchlists")  # noqa: F821
    items: Mapped[list["WatchlistItem"]] = relationship(
        "WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Watchlist(id={self.id}, name={self.name!r}, user_id={self.user_id})>"


class WatchlistItem(Base):
    """A single symbol entry in a watchlist. Duplicate symbols are prevented per watchlist."""
    __tablename__ = "watchlist_items"
    __table_args__ = (
        UniqueConstraint("watchlist_id", "symbol", name="uq_watchlist_symbol"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    watchlist_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    # Relationship
    watchlist: Mapped["Watchlist"] = relationship("Watchlist", back_populates="items")

    def __repr__(self) -> str:
        return f"<WatchlistItem(watchlist_id={self.watchlist_id}, symbol={self.symbol!r})>"
