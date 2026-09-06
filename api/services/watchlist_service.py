"""
services/watchlist_service.py
──────────────────────────────
Watchlist domain service for Xeroww multi-tenant platform.

All operations are tenant-scoped to the requesting user_id.
Symbols stored in watchlist_items are plain strings — market data is never cached here.
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from api.models.watchlist import Watchlist, WatchlistItem


class WatchlistService:
    """Encapsulates all watchlist business logic. Injected per-request."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def list_watchlists(self) -> list[Watchlist]:
        """Return all watchlists owned by this user, ordered by default first."""
        return (
            self.db.query(Watchlist)
            .filter(Watchlist.user_id == self.user_id)
            .order_by(Watchlist.is_default.desc(), Watchlist.created_at)
            .all()
        )

    def get_watchlist(self, watchlist_id: int) -> Watchlist:
        """Return a specific watchlist. Raises 404 if not found or not owned by user."""
        wl = (
            self.db.query(Watchlist)
            .filter(Watchlist.id == watchlist_id, Watchlist.user_id == self.user_id)
            .first()
        )
        if not wl:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Watchlist {watchlist_id} not found.",
            )
        return wl

    # -----------------------------------------------------------------------
    # Mutations
    # -----------------------------------------------------------------------

    def create_watchlist(self, name: str) -> Watchlist:
        """Create a new named watchlist for this user."""
        wl = Watchlist(user_id=self.user_id, name=name.strip(), is_default=False)
        self.db.add(wl)
        self.db.commit()
        self.db.refresh(wl)
        return wl

    def rename_watchlist(self, watchlist_id: int, new_name: str) -> Watchlist:
        """Rename an existing watchlist."""
        wl = self.get_watchlist(watchlist_id)
        wl.name = new_name.strip()
        self.db.commit()
        self.db.refresh(wl)
        return wl

    def delete_watchlist(self, watchlist_id: int) -> None:
        """Delete a watchlist and all its items (cascaded)."""
        wl = self.get_watchlist(watchlist_id)
        if wl.is_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the default watchlist.",
            )
        self.db.delete(wl)
        self.db.commit()

    def add_symbol(self, watchlist_id: int, symbol: str) -> WatchlistItem:
        """Add a symbol to a watchlist. Raises 409 on duplicate."""
        wl = self.get_watchlist(watchlist_id)
        symbol_upper = symbol.strip().upper()
        item = WatchlistItem(watchlist_id=wl.id, symbol=symbol_upper)
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Symbol '{symbol_upper}' is already in this watchlist.",
            )
        self.db.refresh(item)
        return item

    def remove_symbol(self, watchlist_id: int, symbol: str) -> None:
        """Remove a symbol from a watchlist. Raises 404 if not found."""
        wl = self.get_watchlist(watchlist_id)
        symbol_upper = symbol.strip().upper()
        item = (
            self.db.query(WatchlistItem)
            .filter(
                WatchlistItem.watchlist_id == wl.id,
                WatchlistItem.symbol == symbol_upper,
            )
            .first()
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Symbol '{symbol_upper}' not found in watchlist {watchlist_id}.",
            )
        self.db.delete(item)
        self.db.commit()
