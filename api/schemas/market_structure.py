"""
schemas/market_structure.py
───────────────────────────
Pydantic schemas for Market Structure Engine V2:
  - Support & Resistance zones
  - Volume analytics & RVOL
  - Moving averages & crossovers
  - Market regime taxonomy
  - Signal alignment confluence
  - Contextual pattern recognition
"""

from pydantic import BaseModel, Field
from typing import Literal, Any


# ---------------------------------------------------------------------------
# Patterns & Contextual Patterns
# ---------------------------------------------------------------------------
class PatternDetectionSchema(BaseModel):
    pattern: str
    direction: Literal["bullish", "bearish", "neutral"]
    candle_index: int
    timestamp: str
    body_ratio: float
    upper_shadow_ratio: float
    lower_shadow_ratio: float
    category: Literal["reversal", "continuation", "indecision"]
    explanation: str
    context: dict[str, Any] = Field(default_factory=dict)


class ContextualPatternSchema(BaseModel):
    symbol: str
    pattern: str
    direction: str
    category: str
    timestamp: str
    current_price: float
    nearest_support_price: float | None = None
    support_distance_pct: float | None = None
    nearest_resistance_price: float | None = None
    resistance_distance_pct: float | None = None
    current_volume: float
    rvol: float
    volume_state: str
    market_regime: str
    price_vs_ema20: str
    five_session_change_pct: float
    context_summary: str


# ---------------------------------------------------------------------------
# Support & Resistance
# ---------------------------------------------------------------------------
class SRZoneSchema(BaseModel):
    price: float
    zone_low: float
    zone_high: float
    level_type: Literal["support", "resistance"]
    touches: int
    strength: float
    distance_price: float
    distance_pct: float
    timestamps: list[str]


class SupportResistanceResponse(BaseModel):
    symbol: str
    current_price: float
    nearest_support: SRZoneSchema | None = None
    nearest_resistance: SRZoneSchema | None = None
    support_zones: list[SRZoneSchema]
    resistance_zones: list[SRZoneSchema]
    total_swings_detected: int
    methodology_note: str


# ---------------------------------------------------------------------------
# Volume Engine
# ---------------------------------------------------------------------------
class VolumeAnalyticsResponse(BaseModel):
    symbol: str
    current_volume: float
    baseline_avg_volume: float
    baseline_median_volume: float
    rvol: float
    volume_deviation_pct: float
    is_volume_spike: bool
    volume_state: Literal["ELEVATED", "NORMAL", "UNUSUALLY_LOW"]
    price_volume_relationship: Literal[
        "ACCUMULATION", "DISTRIBUTION", "LOW_VOLUME_ADVANCE", "LOW_VOLUME_PULLBACK", "NEUTRAL"
    ]
    breakout_confirmed: bool
    divergence_flag: str | None = None
    explanation: str


# ---------------------------------------------------------------------------
# Moving Averages Engine
# ---------------------------------------------------------------------------
class MovingAveragesResponse(BaseModel):
    symbol: str
    current_price: float
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    ema_9: float | None = None
    ema_20: float | None = None
    price_vs_sma20: str
    price_vs_sma50: str
    price_vs_sma200: str
    price_vs_ema9: str
    price_vs_ema20: str
    ema9_ema20_relationship: str
    sma50_sma200_relationship: str
    structural_summary: list[str]
    series: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Market Regime
# ---------------------------------------------------------------------------
class MarketRegimeResponse(BaseModel):
    symbol: str
    regime: Literal[
        "TRENDING_UP", "TRENDING_DOWN", "RANGE_BOUND", "HIGH_VOLATILITY", "LOW_ACTIVITY", "MIXED"
    ]
    reasons: list[str]
    current_price: float
    atr_pct: float
    rvol: float
    swing_structure: str
    ema_trend: str


# ---------------------------------------------------------------------------
# Signal Alignment (Confluence)
# ---------------------------------------------------------------------------
class AlignmentConditionSchema(BaseModel):
    condition_id: str
    label: str
    bias: Literal["bullish", "bearish"]
    satisfied: bool
    description: str


class SignalAlignmentResponse(BaseModel):
    symbol: str
    current_price: float
    bullish_alignment_count: int
    bearish_alignment_count: int
    alignment_total: int
    dominant_bias: Literal["BULLISH_CONFLUENCE", "BEARISH_CONFLUENCE", "NEUTRAL_MIXED"]
    conditions: list[AlignmentConditionSchema]
    factual_summary: str
    methodology_note: str


# ---------------------------------------------------------------------------
# Unified Market Structure Summary (Single-Trip High Performance)
# ---------------------------------------------------------------------------
class MarketStructureSummaryResponse(BaseModel):
    symbol: str
    current_price: float
    support_resistance: SupportResistanceResponse
    volume: VolumeAnalyticsResponse
    moving_averages: MovingAveragesResponse
    market_regime: MarketRegimeResponse
    signal_alignment: SignalAlignmentResponse
    detected_patterns: list[PatternDetectionSchema]
    contextual_pattern: ContextualPatternSchema | None = None
