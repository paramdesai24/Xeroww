"""
schemas/quote.py
────────────────
Pydantic response schemas for the /quote endpoint.
These define the API contract for market quote data.
"""

from pydantic import BaseModel, Field
from datetime import datetime


class QuoteResponse(BaseModel):
    symbol: str = Field(..., description="Stock ticker symbol (e.g., RELIANCE.NS)")
    display_name: str = Field(..., description="Human-readable company name")
    price: float = Field(..., description="Current/latest closing price in INR")
    previous_close: float = Field(..., description="Previous trading session close price")
    change: float = Field(..., description="Absolute price change from previous close")
    change_pct: float = Field(..., description="Percentage change from previous close")
    day_high: float = Field(..., description="Intraday high price")
    day_low: float = Field(..., description="Intraday low price")
    volume: int = Field(..., description="Trading volume for the current session")
    market_cap: float | None = Field(None, description="Market capitalisation in INR (may be None if unavailable)")
    currency: str = Field(default="INR", description="Currency of all price fields")
    data_note: str = Field(
        default="Near real-time data — Yahoo Finance delayed feed",
        description="Data freshness disclaimer"
    )
    timestamp: datetime = Field(..., description="Timestamp when this quote was fetched")

    model_config = {"from_attributes": True}
