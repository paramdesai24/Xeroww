// src/types/market.ts
// TypeScript interfaces mirroring the Xeroww FastAPI response schemas.
// These are the single source of truth for data shapes across the frontend.

export interface StockMeta {
  symbol: string;
  display_name: string;
  exchange: string;
  sector: string;
}

export interface QuoteData {
  symbol: string;
  display_name: string;
  price: number;
  previous_close: number;
  change: number;
  change_pct: number;
  day_high: number;
  day_low: number;
  volume: number;
  market_cap: number | null;
  currency: string;
  data_note: string;
  timestamp: string;
}

export interface OHLCBar {
  time: string; // "YYYY-MM-DD" — TradingView Lightweight Charts format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCData {
  symbol: string;
  display_name: string;
  period: string;
  interval: string;
  candles: OHLCBar[];
  data_note: string;
}

export interface CandleSummary {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  body_pct: number;
  range_pct: number;
  direction: "bullish" | "bearish" | "doji";
}

export interface PatternData {
  symbol: string;
  display_name: string;
  pattern: "bullish_marubozu" | "bearish_marubozu" | "none";
  signal_day: string | null;
  textbook_action: "watch_next_session_for_confirmation" | "no_marubozu_detected";
  rationale: string;
  stop_loss: number | null;
  latest_candle: CandleSummary;
  detected_patterns?: import("./structure").PatternDetection[];
  contextual_pattern?: import("./structure").ContextualPattern | null;
  data_note: string;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  data_provider: string;
  data_note: string;
}
