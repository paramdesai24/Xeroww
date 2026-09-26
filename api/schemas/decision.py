"""Typed API contracts for the Decision Workbench."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


Direction = Literal["BULLISH", "BEARISH", "NEUTRAL"]
Intent = Literal["ENTER", "ADD", "HOLD", "REDUCE", "EXIT", "WATCH", "AVOID"]
SourceContext = Literal["MANUAL", "MARKET", "REPLAY", "PORTFOLIO", "ALERT"]


class DecisionPlanBase(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    direction: Direction
    intent: Intent
    holding_period: str = Field(min_length=2, max_length=40)
    setup_type: str = Field(min_length=2, max_length=80)
    entry_trigger: str | None = Field(default=None, max_length=1000)
    entry_zone_low: Decimal | None = Field(default=None, gt=0)
    entry_zone_high: Decimal | None = Field(default=None, gt=0)
    invalidation_price: Decimal | None = Field(default=None, gt=0)
    target_zone_low: Decimal | None = Field(default=None, gt=0)
    target_zone_high: Decimal | None = Field(default=None, gt=0)
    max_risk_pct: Decimal | None = Field(default=None, gt=0, le=5)
    max_allocation_pct: Decimal | None = Field(default=None, gt=0, le=100)
    capital_base: Decimal | None = Field(default=None, gt=0)
    confidence: int = Field(ge=1, le=5)
    thesis: str = Field(min_length=10, max_length=5000)
    change_mind_condition: str = Field(min_length=5, max_length=2000)
    portfolio_id: int | None = Field(default=None, gt=0)
    source_context: SourceContext = "MANUAL"
    source_as_of: str | None = None
    source_period: str = Field(default="1y", pattern="^(1mo|3mo|6mo|1y|2y|5y)$")

    @model_validator(mode="after")
    def validate_direction_and_intent(self):
        allowed = {
            "BULLISH": {"ENTER", "ADD", "HOLD", "WATCH"},
            "BEARISH": {"REDUCE", "EXIT", "WATCH", "AVOID"},
            "NEUTRAL": {"HOLD", "WATCH", "AVOID"},
        }
        if self.intent not in allowed[self.direction]:
            raise ValueError(f"Intent {self.intent} is not valid for {self.direction} cash-equity decisions.")
        if self.intent in {"ENTER", "ADD"}:
            required = (
                self.entry_trigger, self.entry_zone_low, self.entry_zone_high,
                self.invalidation_price, self.target_zone_low, self.max_risk_pct,
            )
            if any(value is None or value == "" for value in required):
                raise ValueError("Entry plans require trigger, entry zone, invalidation, target, and risk percentage.")
            if self.capital_base is None and self.portfolio_id is None:
                raise ValueError("Entry plans require either a manual capital base or a portfolio.")
        return self


class DecisionPreviewRequest(DecisionPlanBase):
    pass


class DecisionCreateRequest(DecisionPlanBase):
    expected_as_of: str
    expected_portfolio_snapshot_id: int | None = Field(default=None, gt=0)
    supporting_evidence_keys: list[str] = Field(default_factory=list)
    conflicting_evidence_keys: list[str] = Field(default_factory=list)
    conflicts_reviewed: bool = False


class DecisionPreviewResponse(BaseModel):
    symbol: str
    resolved_as_of: str
    snapshot_hash: str
    data_quality: dict[str, Any]
    evidence: dict[str, Any]
    risk: dict[str, Any]
    warnings: list[str]


class DecisionAmendmentCreate(BaseModel):
    amendment_type: Literal["OBSERVATION", "THESIS_REVISION", "RISK_REVISION"]
    reason: str = Field(min_length=5, max_length=2000)
    payload: dict[str, Any] = Field(default_factory=dict)
    expected_version: int = Field(ge=1)


class DecisionStatusChange(BaseModel):
    status: Literal["CLOSED", "CANCELLED"]
    reason: str = Field(min_length=5, max_length=2000)
    expected_version: int = Field(ge=1)


class DecisionAmendmentResponse(BaseModel):
    id: int
    amendment_type: str
    reason: str
    payload: dict[str, Any]
    from_status: str | None
    to_status: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class DecisionSummaryResponse(BaseModel):
    id: int
    symbol: str
    direction: str | None
    intent: str | None
    status: str
    confidence: int | None
    holding_period: str | None
    source_context: str | None
    source_as_of: datetime | None
    timestamp: datetime
    ticket_version: int
    evidence_summary: str | None
    evidence_counts: dict[str, int]
    data_quality: str | None


class DecisionListResponse(BaseModel):
    items: list[DecisionSummaryResponse]
    total: int
    skip: int
    limit: int


class DecisionDetailResponse(BaseModel):
    id: int
    symbol: str
    direction: str | None
    intent: str | None
    holding_period: str | None
    setup_type: str | None
    entry_trigger: str | None
    entry_zone_low: Decimal | None
    entry_zone_high: Decimal | None
    invalidation_price: Decimal | None
    target_zone_low: Decimal | None
    target_zone_high: Decimal | None
    max_risk_pct: Decimal | None
    max_allocation_pct: Decimal | None
    confidence: int | None
    thesis: str
    change_mind_condition: str | None
    portfolio_id: int | None
    replay_session_id: int | None = None
    replay_event_sequence: int | None = None
    replay_index: int | None = None
    source_context: str | None
    source_as_of: datetime | None
    source_period: str | None
    status: str
    ticket_version: int
    snapshot_hash: str | None
    context_snapshot: dict[str, Any]
    risk_snapshot: dict[str, Any]
    supporting_evidence_keys: list[str]
    conflicting_evidence_keys: list[str]
    submitted_at: datetime | None
    closed_at: datetime | None
    timestamp: datetime
    created_at: datetime
    version: int
    amendments: list[DecisionAmendmentResponse]
