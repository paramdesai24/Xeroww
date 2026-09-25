"""
schemas/watchlist.py
────────────────────
Pydantic schemas for the watchlist domain.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class WatchlistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["NSE Blue Chips"])


class WatchlistUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Renamed List"])


class WatchlistAddSymbol(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=30, examples=["RELIANCE.NS"])


class WatchlistItemResponse(BaseModel):
    id: int
    symbol: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WatchlistResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: datetime
    item_count: int = 0

    model_config = {"from_attributes": True}


class WatchlistDetailResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: datetime
    items: list[WatchlistItemResponse]

    model_config = {"from_attributes": True}


class WatchlistSnapshotRow(BaseModel):
    symbol: str
    company_name: str
    price: float | None = None
    change: float | None = None
    change_pct: float | None = None
    quote_timestamp: str | None = None
    context: str
    available: bool
    reason: str | None = None


class WatchlistSnapshotResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    as_of: str
    data_note: str
    rows: list[WatchlistSnapshotRow]
