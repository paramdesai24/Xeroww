"""Shared explainability contracts for replay and portfolio calculations."""

from typing import Any, Literal

from pydantic import BaseModel, Field


DataQualityState = Literal["COMPLETE", "PARTIAL", "STALE", "INSUFFICIENT"]


class CalculationEnvelope(BaseModel):
    formula_id: str
    formula_version: str
    observation_start: str | None = None
    observation_end: str | None = None
    observation_count: int = 0
    inputs: dict[str, Any] = Field(default_factory=dict)
    result: Any = None
    unit: str
    data_quality: DataQualityState = "COMPLETE"
    limitations: list[str] = Field(default_factory=list)


class ProvenanceEnvelope(BaseModel):
    provider: str
    requested_interval: str
    resolved_interval: str
    source_as_of: str | None = None
    latest_market_timestamp: str | None = None
    timezone: str = "Asia/Kolkata"
    analytics_version: str
    source_fingerprint: str
    data_quality: DataQualityState = "COMPLETE"
    missing_symbols: list[str] = Field(default_factory=list)
    partial: bool = False

