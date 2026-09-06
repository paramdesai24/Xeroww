"""
schemas/alert.py
────────────────
Pydantic schemas for the alert domain.
"""

from datetime import datetime
from pydantic import BaseModel, Field


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


class AlertResponse(BaseModel):
    id: int
    symbol: str
    alert_type: str
    condition_payload: dict
    enabled: bool
    triggered_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertEvaluationResult(BaseModel):
    alert_id: int
    symbol: str
    alert_type: str
    triggered: bool
    current_value: float | None = None
    condition_payload: dict
    message: str
