"""
routes/watchlists.py
─────────────────────
Watchlist API endpoints — all routes require authentication and are tenant-scoped.

All mutations operate on the current user's watchlists only.
Market data is never stored in watchlists — symbols are plain string references.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.models.watchlist import Watchlist
from api.services.watchlist_service import WatchlistService
from api.schemas.watchlist import (
    WatchlistCreate,
    WatchlistUpdate,
    WatchlistAddSymbol,
    WatchlistResponse,
    WatchlistDetailResponse,
    WatchlistItemResponse,
)

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


def _to_response(wl: Watchlist) -> WatchlistResponse:
    return WatchlistResponse(
        id=wl.id,
        name=wl.name,
        is_default=wl.is_default,
        created_at=wl.created_at,
        item_count=len(wl.items),
    )


def _to_detail_response(wl: Watchlist) -> WatchlistDetailResponse:
    return WatchlistDetailResponse(
        id=wl.id,
        name=wl.name,
        is_default=wl.is_default,
        created_at=wl.created_at,
        items=[WatchlistItemResponse.model_validate(item) for item in wl.items],
    )


@router.get("", response_model=list[WatchlistResponse], summary="List all watchlists for current user")
def list_watchlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    watchlists = svc.list_watchlists()
    return [_to_response(wl) for wl in watchlists]


@router.post(
    "",
    response_model=WatchlistDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new watchlist",
)
def create_watchlist(
    body: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    wl = svc.create_watchlist(body.name)
    return _to_detail_response(wl)


@router.get("/{watchlist_id}", response_model=WatchlistDetailResponse, summary="Get watchlist with symbols")
def get_watchlist(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    wl = svc.get_watchlist(watchlist_id)
    return _to_detail_response(wl)


@router.patch("/{watchlist_id}", response_model=WatchlistDetailResponse, summary="Rename a watchlist")
def rename_watchlist(
    watchlist_id: int,
    body: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    wl = svc.rename_watchlist(watchlist_id, body.name)
    return _to_detail_response(wl)


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a watchlist")
def delete_watchlist(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    svc.delete_watchlist(watchlist_id)


@router.post(
    "/{watchlist_id}/symbols",
    response_model=WatchlistItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a symbol to a watchlist",
)
def add_symbol(
    watchlist_id: int,
    body: WatchlistAddSymbol,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    item = svc.add_symbol(watchlist_id, body.symbol)
    return WatchlistItemResponse.model_validate(item)


@router.delete(
    "/{watchlist_id}/symbols/{symbol}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a symbol from a watchlist",
)
def remove_symbol(
    watchlist_id: int,
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = WatchlistService(db, current_user.id)
    svc.remove_symbol(watchlist_id, symbol)
