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

export interface ReplayTimelineItem {
  index: number;
  time: string;
  close: number;
  volume: number;
}


export interface ReplayTimelineResponse {
  symbol: string;
  total_bars: number;
  timeline: ReplayTimelineItem[];
}

export interface ReplayStepResponse {
  symbol: string;
  current_step: number;
  total_steps: number;
  is_complete: boolean;
  current_candle: { time: string; open: number; high: number; low: number; close: number; volume: number } | null;
  candles_slice: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
  moving_averages: MovingAveragesResponse | null;
  support_resistance: SupportResistanceResponse | null;
  volume: VolumeAnalyticsResponse | null;
  market_regime: MarketRegimeResponse | null;
  signal_alignment: SignalAlignmentResponse | null;
  pattern: { pattern: string; direction: string; category: string; explanation: string } | null;
}

export interface EventDiffItem {
  category: string;
  type: string;
  delta?: number;
  delta_pct?: number;
  description: string;
  level?: number;
  from_regime?: string;
  to_regime?: string;
}

export interface EventDiffResponse {
  symbol: string;
  from_step: number;
  to_step: number;
  from_time: string | null;
  to_time: string | null;
  price_delta: number;
  price_delta_pct: number;
  event_count: number;
  events: EventDiffItem[];
  factual_narrative: string[];
}

export interface CandleForensicsResponse {
  symbol: string;
  timestamp: string;
  ohlc: { open: number; high: number; low: number; close: number; day_range: number; is_bullish: boolean };
  anatomy: {
    body_size: number;
    upper_shadow: number;
    lower_shadow: number;
    body_ratio_pct: number;
    upper_shadow_ratio_pct: number;
    lower_shadow_ratio_pct: number;
  };
  volume_context: {
    volume: number;
    baseline_volume: number;
    rvol: number;
    volume_state: string;
    relationship: string;
  };
  pattern_context: { pattern: string; explanation: string };
  support_resistance_context: {
    nearest_support: SRZone | null;
    nearest_resistance: SRZone | null;
    active_zones_count: number;
  };
  moving_average_context: {
    price_vs_ema20: string;
    ema9_ema20_relationship: string;
    sma50_sma200_relationship: string;
  };
  regime_context: { regime: string; reasons: string[] };
  provenance: {
    source_provider: string;
    symbol: string;
    timeframe: string;
    input_interval: string;
    calculation_window: string;
    calculation_timestamp: string;
    algorithm_version: string;
    source_candle_range: { start: string | null; end: string | null; bar_count: number };
  };
}

export interface HoldingContribution {
  symbol: string;
  quantity: number;
  current_price: number;
  previous_close: number;
  price_change: number;
  price_change_pct: number;
  current_value: number;
  allocation_pct: number;
  pnl_contribution_inr: number;
  pnl_contribution_pct: number;
}

export interface PortfolioContributionResponse {
  portfolio_id: number;
  portfolio_name: string;
  total_value: number;
  day_pnl_inr: number;
  day_pnl_pct: number;
  holdings: HoldingContribution[];
  largest_contributor: HoldingContribution | null;
  largest_detractor: HoldingContribution | null;
  biggest_allocation: HoldingContribution | null;
}

export interface MarketBreadthResponse {
  universe_size: number;
  advancing: number;
  declining: number;
  unchanged: number;
  breadth_ratio: number;
  distribution_buckets: {
    gain_gt_2pct: number;
    gain_0_to_2pct: number;
    loss_0_to_2pct: number;
    loss_gt_2pct: number;
  };
  top_gainers: { symbol: string; change_pct: number; price: number }[];
  top_losers: { symbol: string; change_pct: number; price: number }[];
  most_active_by_volume: { symbol: string; volume: number; price: number }[];
}

export interface CorrelationMatrixResponse {
  window: number;
  symbols: string[];
  matrix: Record<string, Record<string, number>>;
  disclaimer: string;
}

