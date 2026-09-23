"""Typed API contracts for Portfolio Intelligence."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class PortfolioSnapshotHoldingResponse(BaseModel):
    symbol: str
    sector: str
    quantity: Decimal
    average_price: Decimal
    cost_basis: Decimal
    market_price: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    portfolio_weight: Decimal
    data_as_of: datetime | None
    is_stale: bool

    model_config = {"from_attributes": True}


class PortfolioSnapshotResponse(BaseModel):
    id: int
    portfolio_id: int
    as_of: datetime
    valuation_date: date
    snapshot_sequence: int
    cash: Decimal
    holdings_value: Decimal
    total_value: Decimal
    cost_basis: Decimal
    realized_pnl_to_date: Decimal
    unrealized_pnl: Decimal
    benchmark_symbol: str
    benchmark_close: Decimal | None
    open_decision_count: int
    data_quality: dict[str, Any]
    source_fingerprint: str
    valuation_version: str
    holdings: list[PortfolioSnapshotHoldingResponse]

    model_config = {"from_attributes": True}


class PortfolioSnapshotList(BaseModel):
    items: list[PortfolioSnapshotResponse]
    total: int
    skip: int
    limit: int


class RiskPolicyUpdate(BaseModel):
    max_single_stock_pct: Decimal = Field(gt=0, le=100)
    max_sector_pct: Decimal = Field(gt=0, le=100)
    max_planned_loss_pct: Decimal = Field(gt=0, le=20)
    max_total_open_risk_pct: Decimal = Field(gt=0, le=50)
    correlation_warning: Decimal = Field(ge=-1, le=1)
    drawdown_review_pct: Decimal = Field(gt=0, le=100)
    minimum_observations: int = Field(ge=5, le=500)
    expected_version: int = Field(ge=1)


class RiskPolicyResponse(BaseModel):
    portfolio_id: int
    max_single_stock_pct: Decimal
    max_sector_pct: Decimal
    max_planned_loss_pct: Decimal
    max_total_open_risk_pct: Decimal
    correlation_warning: Decimal
    drawdown_review_pct: Decimal
    minimum_observations: int
    version: int

    model_config = {"from_attributes": True}


class PortfolioImpactRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    quantity: Decimal = Field(gt=0)
    entry_price: Decimal = Field(gt=0)
    invalidation_price: Decimal = Field(gt=0)
    expected_snapshot_id: int | None = Field(default=None, gt=0)


class PortfolioAnalyticsResponse(BaseModel):
    portfolio_id: int
    latest_snapshot_id: int | None
    data_quality: dict[str, Any]
    metrics: dict[str, Any]
    series: dict[str, Any] = Field(default_factory=dict)
    warnings: list[dict[str, Any]] = Field(default_factory=list)

