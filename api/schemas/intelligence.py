"""
schemas/intelligence.py
────────────────────────
Pydantic schemas for the intelligence domain (journal and chart annotations).
"""

from datetime import datetime
from pydantic import BaseModel, Field


class JournalEntryCreate(BaseModel):
    symbol: str = Field(..., examples=["RELIANCE.NS"])
    action: str = Field(..., examples=["BUY"], max_length=20)
    thesis: str = Field(..., min_length=10, examples=["Strong breakout above resistance on high volume."])
    context_snapshot: dict = Field(default_factory=dict)


class JournalEntryUpdate(BaseModel):
    status: str = Field(..., pattern="^(OPEN|CLOSED|CANCELLED)$", examples=["CLOSED"])
    thesis: str | None = Field(None)


class JournalEntryResponse(BaseModel):
    id: int
    symbol: str
    action: str
    thesis: str
    context_snapshot: dict
    status: str
    timestamp: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
