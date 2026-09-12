// src/types/events.ts
// Institutional TypeScript interfaces for Xeroww Market Event Timeline and Explainability Engine.
// Strictly chronological, deterministic domain events with point-in-time rule evidence.

export type MarketEventType =
  | "PRICE_BREAKOUT"
  | "PRICE_BREAKDOWN"
  | "SUPPORT_TEST"
  | "RESISTANCE_REJECTION"
  | "PATTERN_DETECTED"
  | "EMA_CROSS"
  | "HIGH_RVOL"
  | "TREND_REVERSAL";

export type EventSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface ExplainabilityPayload {
  signal: string;
  confidence: number; // 0.0 to 1.0 (derived strictly from rule coverage)
  evidence: string[];
  triggeredRules: string[];
}

export interface MarketEvent {
  id: string;
  timestamp: string; // YYYY-MM-DD
  symbol: string;
  type: MarketEventType;
  severity: EventSeverity;
  title: string;
  description: string;
  evidence: string[];
  candle_index: number;
  explainability: ExplainabilityPayload;
  metadata?: Record<string, unknown>;
}

export interface MarketEventsTimelineResponse {
  symbol: string;
  total_events: number;
  events: MarketEvent[];
}
