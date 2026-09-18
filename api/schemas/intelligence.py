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
    status: str | None = Field(None, pattern="^(OPEN|CLOSED|CANCELLED)$", examples=["CLOSED"])
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


class AnnotationCreate(BaseModel):
    symbol: str
    timeframe: str = "1d"
    timestamp: datetime
    annotation_type: str = "note"
    content: str
    metadata_json: dict = Field(default_factory=dict)


class AnnotationResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    timeframe: str
    timestamp: datetime
    annotation_type: str
    content: str
    metadata_json: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class SymbolMemorySummary(BaseModel):
    symbol: str
    total_annotations: int
    total_journal_entries: int
    saved_observations: list[str]
    last_observation_date: str | None
