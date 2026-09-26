"""
schemas/alert.py
────────────────
Pydantic schemas for the alert domain.
"""

from datetime import datetime
from typing import Literal
import math
from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator
from api.data.nifty50 import NIFTY50

ALERT_TYPES = {"price_above", "price_below", "percentage_move", "volume_spike", "pattern_detected", "moving_average_cross"}
SUPPORTED_SYMBOLS = {stock["symbol"] for stock in NIFTY50}


def validate_condition(alert_type: str, payload: dict) -> dict:
    def positive(name: str) -> float:
        value = payload.get(name)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be a positive number")
        return float(value)

    if alert_type in {"price_above", "price_below"}:
        return {"threshold": positive("threshold")}
    if alert_type == "percentage_move":
        pct = positive("pct")
        reference = positive("reference_price")
        direction = payload.get("direction")
        if direction not in {"up", "down", "any"}:
            raise ValueError("direction must be up, down, or any")
        return {"pct": pct, "reference_price": reference, "direction": direction}
    if alert_type == "volume_spike":
        return {"multiplier": positive("multiplier")}
    if alert_type == "pattern_detected":
        pattern = payload.get("pattern")
        if pattern not in {"bullish_marubozu", "bearish_marubozu", "any"}:
            raise ValueError("pattern must be bullish_marubozu, bearish_marubozu, or any")
        return {"pattern": pattern}
    if alert_type == "moving_average_cross":
        fast, slow = payload.get("fast_period"), payload.get("slow_period")
        if any(isinstance(value, bool) or not isinstance(value, int) or value < 2 or value > 200 for value in (fast, slow)) or fast >= slow:
            raise ValueError("fast_period and slow_period must be 2 to 200, with fast below slow")
        direction = payload.get("direction")
        if direction not in {"golden_cross", "death_cross", "any"}:
            raise ValueError("direction must be golden_cross, death_cross, or any")
        return {"fast_period": fast, "slow_period": slow, "direction": direction}
    raise ValueError("Choose a supported alert type")


class AlertCreate(BaseModel):
    symbol: str = Field(..., examples=["RELIANCE.NS"])
    alert_type: str = Field(
        ...,
        examples=["price_above"],
        description=(
            "One of: price_above, price_below, percentage_move, "
            "volume_spike, pattern_detected, moving_average_cross"
        ),
    )
    condition_payload: dict = Field(
        ...,
        examples=[{"threshold": 2500.0}],
        description="Alert-type-specific parameters as a JSON object.",
    )

    @field_validator("symbol")
    @classmethod
    def supported_symbol(cls, value: str) -> str:
        symbol = value.strip().upper()
        if symbol not in SUPPORTED_SYMBOLS:
            raise ValueError("Choose a NIFTY50 company")
        return symbol

    @field_validator("condition_payload")
    @classmethod
    def valid_condition(cls, value: dict, info: ValidationInfo) -> dict:
        return validate_condition(info.data.get("alert_type", ""), value)


class AlertPatch(BaseModel):
    enabled: bool | None = None
    alert_type: str | None = None
    condition_payload: dict | None = None

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set or any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Provide a valid alert change")
        return self


class AlertEvaluationSummary(BaseModel):
    id: int
    alert_id: int
    evaluated_at: datetime
    triggered: bool
    observed_value: float | None
    message: str
    data_quality_status: Literal["ok", "delayed", "insufficient", "error"]

    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: int
    symbol: str
    alert_type: str
    condition_payload: dict
    enabled: bool
    triggered_at: datetime | None
    created_at: datetime
    latest_evaluation: AlertEvaluationSummary | None = None

    model_config = {"from_attributes": True}


class AlertEvaluationResult(BaseModel):
    alert_id: int
    symbol: str
    alert_type: str
    triggered: bool
    current_value: float | None = None
    condition_payload: dict
    message: str
    data_quality_status: Literal["ok", "delayed", "insufficient", "error"] = "ok"
    evaluated_at: datetime | None = None
    evaluation_id: int | None = None
