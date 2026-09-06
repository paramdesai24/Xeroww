"""
schemas/contribution.py
───────────────────────
Pydantic schemas for Portfolio Today's Contribution & Diff Analytics.
"""

from typing import Optional
from pydantic import BaseModel


class HoldingContribution(BaseModel):
    symbol: str
    quantity: float
    current_price: float
    previous_close: float
    price_change: float
    price_change_pct: float
    current_value: float
    allocation_pct: float
    pnl_contribution_inr: float
    pnl_contribution_pct: float


class PortfolioContributionResponse(BaseModel):
    portfolio_id: int
    portfolio_name: str
    total_value: float
    day_pnl_inr: float
    day_pnl_pct: float
    holdings: list[HoldingContribution]
    largest_contributor: Optional[HoldingContribution] = None
    largest_detractor: Optional[HoldingContribution] = None
    biggest_allocation: Optional[HoldingContribution] = None
