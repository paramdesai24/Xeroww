"""
schemas/events.py
─────────────────
Domain event schemas and Explainability models for Xeroww Market Event Timeline.
Pure deterministic contracts with zero forward-looking bias.
"""

from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class MarketEventType(str, Enum):
    PRICE_BREAKOUT = "PRICE_BREAKOUT"
    PRICE_BREAKDOWN = "PRICE_BREAKDOWN"
    SUPPORT_TEST = "SUPPORT_TEST"
    RESISTANCE_REJECTION = "RESISTANCE_REJECTION"
    PATTERN_DETECTED = "PATTERN_DETECTED"
    EMA_CROSS = "EMA_CROSS"
    HIGH_RVOL = "HIGH_RVOL"
    TREND_REVERSAL = "TREND_REVERSAL"


class EventSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class ExplainabilityPayload(BaseModel):
    signal: str = Field(..., description="Deterministic signal identifier")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence derived strictly from rule coverage")
    evidence: List[str] = Field(default_factory=list, description="Verifiable empirical evidence points")
    triggeredRules: List[str] = Field(default_factory=list, description="Specific mathematical rules satisfied")


class MarketEvent(BaseModel):
    id: str = Field(..., description="Deterministic event identifier")
    timestamp: str = Field(..., description="Candle timestamp YYYY-MM-DD")
    symbol: str = Field(..., description="Asset symbol")
    type: MarketEventType = Field(..., description="Classification category")
    severity: EventSeverity = Field(..., description="Visual and operational priority")
    title: str = Field(..., description="Concise single-line institutional headline")
    description: str = Field(..., description="Deterministic factual description")
    evidence: List[str] = Field(default_factory=list, description="Empirical rule evidence points")
    candle_index: int = Field(..., description="Replay step index")
    explainability: ExplainabilityPayload = Field(..., description="Audit and rule coverage telemetry")
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict, description="Additional context numbers")


class MarketEventsTimelineResponse(BaseModel):
    symbol: str
    total_events: int
    events: List[MarketEvent]
