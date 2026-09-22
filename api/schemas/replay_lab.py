"""Typed API contracts for persisted Replay Lab sessions."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class ReplaySessionCreate(BaseModel):
    symbol: str | None = Field(default=None, max_length=30)
    randomize_symbol: bool = False
    start_date: str | None = None
    randomize_start: bool = False
    timeframe: Literal["1d", "1h", "15m"] = "1d"
    session_bars: int = Field(default=20, ge=5, le=120)
    starting_capital: Decimal = Field(default=Decimal("100000"), gt=0)
    maximum_risk_pct: Decimal = Field(default=Decimal("1"), gt=0, le=5)
    setup_category: str | None = Field(default=None, max_length=80)
    hide_symbol: bool = False
    hide_calendar_date: bool = False

    @model_validator(mode="after")
    def validate_selection(self):
        if not self.randomize_symbol and not self.symbol:
            raise ValueError("Choose a symbol or enable randomized symbol selection.")
        if self.randomize_symbol and self.symbol:
            raise ValueError("Provide a symbol or randomize it, not both.")
        if self.randomize_start and self.start_date:
            raise ValueError("Provide a start date or randomize it, not both.")
        return self


class ReplayCommand(BaseModel):
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=80)


class ReplayReflectionCreate(BaseModel):
    prompt_key: str = Field(min_length=3, max_length=80)
    response: str = Field(min_length=1, max_length=2000)
    phase: Literal["PRE_DECISION", "POST_SESSION"]
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=80)


class ReplayExitCreate(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=0)
    reason_category: Literal["TARGET", "INVALIDATION", "EVIDENCE", "EMOTION", "TIME", "OTHER"]
    explanation: str | None = Field(default=None, max_length=2000)
    evidence_keys: list[str] = Field(default_factory=list)
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=80)


class ReplayEventResponse(BaseModel):
    id: int
    sequence_number: int
    event_type: str
    replay_index: int
    simulated_at: datetime
    occurred_at: datetime
    decision_id: int | None
    payload: dict[str, Any]
    evidence_snapshot_hash: str | None

    model_config = {"from_attributes": True}


class ReplaySessionSummary(BaseModel):
    id: int
    status: str
    symbol: str
    timeframe: str
    setup_category: str | None
    current_index: int
    start_index: int
    end_index: int
    current_market_time: datetime
    completion_reason: str | None
    process_score: Decimal | None = None
    version: int
    created_at: datetime


class ReplaySessionList(BaseModel):
    items: list[ReplaySessionSummary]
    total: int
    skip: int
    limit: int


class ReplaySessionState(BaseModel):
    id: int
    status: str
    symbol: str
    symbol_hidden: bool
    calendar_date_hidden: bool
    timeframe: str
    setup_category: str | None
    starting_capital: Decimal
    current_cash: Decimal
    maximum_risk_pct: Decimal
    current_index: int
    visible_step: int
    total_session_steps: int
    remaining_bars: int
    current_market_time: datetime
    version: int
    decision_required: bool
    active_decision_id: int | None
    position: dict[str, Any]
    candles: list[dict[str, Any]]
    analytics: dict[str, Any]
    compact_evidence: list[dict[str, Any]]
    provenance: dict[str, Any]


class ReplayReviewResponse(BaseModel):
    session: ReplaySessionSummary
    process: dict[str, Any]
    outcome: dict[str, Any]
    behaviour_observations: list[dict[str, Any]]
    events: list[ReplayEventResponse]


class ReplayAnalyticsResponse(BaseModel):
    session_count: int
    eligible_outcome_count: int
    summary: dict[str, Any]
    groups: dict[str, list[dict[str, Any]]]
    behaviour_observations: list[dict[str, Any]]

