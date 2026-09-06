"""
schemas/replay.py
─────────────────
Pydantic schemas for the Historical Market Replay Engine.
"""

from typing import Any, Optional
from pydantic import BaseModel
from api.schemas.market_structure import (
    SupportResistanceResponse,
    VolumeAnalyticsResponse,
    MovingAveragesResponse,
    MarketRegimeResponse,
    SignalAlignmentResponse,
)


class ReplayTimelineItem(BaseModel):
    index: int
    time: str
    close: float
    volume: int


class ReplayTimelineResponse(BaseModel):
    symbol: str
    total_bars: int
    timeline: list[ReplayTimelineItem]


class ReplayStepResponse(BaseModel):
    symbol: str
    current_step: int
    total_steps: int
    is_complete: bool
    current_candle: Optional[dict[str, Any]] = None
    candles_slice: list[dict[str, Any]]
    moving_averages: Optional[MovingAveragesResponse] = None
    support_resistance: Optional[SupportResistanceResponse] = None
    volume: Optional[VolumeAnalyticsResponse] = None
    market_regime: Optional[MarketRegimeResponse] = None
    signal_alignment: Optional[SignalAlignmentResponse] = None
    pattern: Optional[dict[str, Any]] = None
