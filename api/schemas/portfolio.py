"""
schemas/portfolio.py
────────────────────
Pydantic schemas for the portfolio domain.
Market prices in responses are computed live — never stored.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class PortfolioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["My Paper Portfolio"])


class TradeOrderRequest(BaseModel):
    symbol: str = Field(..., examples=["RELIANCE.NS"])
    side: str = Field(..., pattern="^(BUY|SELL)$", examples=["BUY"])
    quantity: float = Field(..., gt=0, examples=[10])
    # If None, uses live market price from MarketDataProvider
    limit_price: float | None = Field(None, gt=0, examples=[2500.0])


class HoldingResponse(BaseModel):
    symbol: str
    quantity: float
    average_price: float
    # Live-computed fields (not stored)
    current_price: float | None = None
    current_value: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None
    allocation_pct: float | None = None


class TransactionResponse(BaseModel):
    id: int
    symbol: str
    side: str
    quantity: float
    execution_price: float
    realized_pnl: float | None
    timestamp: datetime

    model_config = {"from_attributes": True}


class PortfolioResponse(BaseModel):
    id: int
    name: str
    cash_balance: float
    created_at: datetime

    model_config = {"from_attributes": True}


class PortfolioSummaryResponse(BaseModel):
    id: int
    name: str
    cash_balance: float
    holdings_value: float
    total_value: float
    total_unrealized_pnl: float
    total_unrealized_pnl_pct: float
    holdings: list[HoldingResponse]
    created_at: datetime
