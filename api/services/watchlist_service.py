"""
services/watchlist_service.py
──────────────────────────────
Watchlist domain service for Xeroww multi-tenant platform.

All operations are tenant-scoped to the requesting user_id.
Symbols stored in watchlist_items are plain strings — market data is never cached here.
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api.models.watchlist import Watchlist, WatchlistItem
from api.core.exceptions import XerowwException
from api.data.nifty50 import NIFTY50

SUPPORTED_SYMBOLS = {stock["symbol"] for stock in NIFTY50}


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
            raise XerowwException("Watchlist not found.", code="WATCHLIST_NOT_FOUND", status_code=404)
        return wl

    # -----------------------------------------------------------------------
    # Mutations
    # -----------------------------------------------------------------------

    def create_watchlist(self, name: str) -> Watchlist:
        """Create a new named watchlist for this user."""
        if not name.strip():
            raise XerowwException("Enter a watchlist name.", code="INVALID_WATCHLIST_NAME", status_code=422)
        wl = Watchlist(user_id=self.user_id, name=name.strip(), is_default=False)
        self.db.add(wl)
        self.db.commit()
        self.db.refresh(wl)
        return wl

    def rename_watchlist(self, watchlist_id: int, new_name: str) -> Watchlist:
        """Rename an existing watchlist."""
        wl = self.get_watchlist(watchlist_id)
        if not new_name.strip():
            raise XerowwException("Enter a watchlist name.", code="INVALID_WATCHLIST_NAME", status_code=422)
        wl.name = new_name.strip()
        self.db.commit()
        self.db.refresh(wl)
        return wl

    def delete_watchlist(self, watchlist_id: int) -> None:
        """Delete a watchlist and all its items (cascaded)."""
        wl = self.get_watchlist(watchlist_id)
        if wl.is_default:
            raise XerowwException("The default watchlist cannot be deleted.", code="DEFAULT_WATCHLIST", status_code=400)
        self.db.delete(wl)
        self.db.commit()

    def add_symbol(self, watchlist_id: int, symbol: str) -> WatchlistItem:
        """Add a symbol to a watchlist. Raises 409 on duplicate."""
        wl = self.get_watchlist(watchlist_id)
        symbol_upper = symbol.strip().upper()
        if symbol_upper not in SUPPORTED_SYMBOLS:
            raise XerowwException("Choose a supported NIFTY 50 symbol.", code="INVALID_SYMBOL", status_code=422)
        item = WatchlistItem(watchlist_id=wl.id, symbol=symbol_upper)
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise XerowwException("This symbol is already in the watchlist.", code="DUPLICATE_SYMBOL", status_code=409)
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
            raise XerowwException("Symbol not found in this watchlist.", code="SYMBOL_NOT_FOUND", status_code=404)
        self.db.delete(item)
        self.db.commit()
