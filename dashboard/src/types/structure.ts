// src/types/structure.ts
// Deterministic Market Structure Types: S/R, Volume, MAs, Regime, Alignment, Contextual Patterns.

export interface SRZone {
  price: number;
  zone_low: number;
  zone_high: number;
  level_type: "support" | "resistance";
  touches: number;
  strength: number;
  distance_price: number;
  distance_pct: number;
  timestamps: string[];
}

export interface SupportResistanceResponse {
  symbol: string;
  current_price: number;
  nearest_support: SRZone | null;
  nearest_resistance: SRZone | null;
  support_zones: SRZone[];
  resistance_zones: SRZone[];
  total_swings_detected: number;
  methodology_note: string;
}

export interface VolumeAnalyticsResponse {
  symbol: string;
  current_volume: number;
  baseline_avg_volume: number;
  baseline_median_volume: number;
  rvol: number;
  volume_deviation_pct: number;
  is_volume_spike: boolean;
  volume_state: "ELEVATED" | "NORMAL" | "UNUSUALLY_LOW";
  price_volume_relationship: "ACCUMULATION" | "DISTRIBUTION" | "LOW_VOLUME_ADVANCE" | "LOW_VOLUME_PULLBACK" | "NEUTRAL";
  breakout_confirmed: boolean;
  divergence_flag: string | null;
  explanation: string;
}

export interface MovingAveragesResponse {
  symbol: string;
  current_price: number;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_9: number | null;
  ema_20: number | null;
  price_vs_sma20: string;
  price_vs_sma50: string;
  price_vs_sma200: string;
  price_vs_ema9: string;
  price_vs_ema20: string;
  ema9_ema20_relationship: string;
  sma50_sma200_relationship: string;
  structural_summary: string[];
  series: {
    time: string;
    sma_20: number | null;
    sma_50: number | null;
    sma_200: number | null;
    ema_9: number | null;
    ema_20: number | null;
  }[];
}

export interface MarketRegimeResponse {
  symbol: string;
  regime: "TRENDING_UP" | "TRENDING_DOWN" | "RANGE_BOUND" | "HIGH_VOLATILITY" | "LOW_ACTIVITY" | "MIXED";
  reasons: string[];
  current_price: number;
  atr_pct: number;
  rvol: number;
  swing_structure: string;
  ema_trend: string;
}

export interface AlignmentCondition {
  condition_id: string;
  label: string;
  bias: "bullish" | "bearish";
  satisfied: boolean;
  description: string;
}

export interface SignalAlignmentResponse {
  symbol: string;
  current_price: number;
  bullish_alignment_count: number;
  bearish_alignment_count: number;
  alignment_total: number;
  dominant_bias: "BULLISH_CONFLUENCE" | "BEARISH_CONFLUENCE" | "NEUTRAL_MIXED";
  conditions: AlignmentCondition[];
  factual_summary: string;
  methodology_note: string;
}

export interface PatternDetection {
  pattern: string;
  direction: "bullish" | "bearish" | "neutral";
  candle_index: number;
  timestamp: string;
  body_ratio: number;
  upper_shadow_ratio: number;
  lower_shadow_ratio: number;
  category: "reversal" | "continuation" | "indecision";
  explanation: string;
  context: Record<string, unknown>;
}

export interface ContextualPattern {
  symbol: string;
  pattern: string;
  direction: string;
  category: string;
  timestamp: string;
  current_price: number;
  nearest_support_price: number | null;
  support_distance_pct: number | null;
  nearest_resistance_price: number | null;
  resistance_distance_pct: number | null;
  current_volume: number;
  rvol: number;
  volume_state: string;
  market_regime: string;
  price_vs_ema20: string;
  five_session_change_pct: number;
  context_summary: string;
}

export interface MarketStructureSummaryResponse {
  symbol: string;
  current_price: number;
  support_resistance: SupportResistanceResponse;
  volume: VolumeAnalyticsResponse;
  moving_averages: MovingAveragesResponse;
  market_regime: MarketRegimeResponse;
  signal_alignment: SignalAlignmentResponse;
  detected_patterns: PatternDetection[];
  contextual_pattern: ContextualPattern | null;
}
