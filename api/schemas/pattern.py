"""
schemas/pattern.py
──────────────────
Pydantic response schemas for the /patterns endpoint.

Implements Varsity-aligned Marubozu detection output with textbook trade setup guidance.
"""

from pydantic import BaseModel, Field
from typing import Literal, Any


class CandleSummary(BaseModel):
    """
    Latest candle analytical summary — body % of range, direction, momentum.
    Useful for at-a-glance understanding of the most recent session.
    """
    date: str = Field(..., description="Date of the candle in YYYY-MM-DD format")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Session high")
    low: float = Field(..., description="Session low")
    close: float = Field(..., description="Closing price")
    body_pct: float = Field(..., description="Body as percentage of the full day range: abs(close-open)/(high-low)*100")
    range_pct: float = Field(..., description="Day range as percentage of open: (high-low)/open*100")
    direction: Literal["bullish", "bearish", "doji"] = Field(
        ..., description="Candle direction based on close vs open"
    )

    model_config = {"from_attributes": True}


class PatternResponse(BaseModel):
    """
    Marubozu pattern detection with Varsity textbook trade setup.
    """
    symbol: str = Field(..., description="Stock ticker symbol")
    display_name: str = Field(..., description="Human-readable company name")

    # Pattern detection
    pattern: Literal["bullish_marubozu", "bearish_marubozu", "none"] = Field(
        ..., description="Detected candle pattern on the latest session"
    )
    signal_day: str | None = Field(
        None, description="Date of the detected signal candle (YYYY-MM-DD)"
    )

    # Varsity textbook setup
    textbook_action: Literal[
        "watch_next_session_for_confirmation",
        "no_marubozu_detected"
    ] = Field(..., description="Varsity-aligned trade action guidance")
    rationale: str = Field(..., description="Explanation of the signal and expected behaviour")
    stop_loss: float | None = Field(
        None,
        description="Suggested stop-loss level per Varsity rules (Day Low for bullish, Day High for bearish)"
    )

    # Latest candle analytics
    latest_candle: CandleSummary = Field(..., description="Analytical breakdown of the most recent candle")

    # Pattern Engine V2 Multi-Pattern Additions (deterministic)
    detected_patterns: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of all detected patterns across recent candles"
    )
    contextual_pattern: dict[str, Any] | None = Field(
        None,
        description="Enriched contextual analysis with S/R, RVOL, and moving average structure"
    )

    data_note: str = Field(
        default="Near real-time data — Yahoo Finance delayed feed",
        description="Data freshness disclaimer"
    )

    model_config = {"from_attributes": True}
