// src/types/xray.ts
// Institutional TypeScript types for Xeroww Flagship X-Ray Mode.
// High-precision geometric anatomy, deterministic pattern evaluation, market structure, and truthful data lineage.

import type { OHLCBar } from "./market";
import type { SRZone } from "./structure";

export type CandleDirection = "BULLISH" | "BEARISH" | "NEUTRAL_DOJI";
export type PatternDirectionType = "bullish" | "bearish" | "neutral";
export type PatternCategoryType = "reversal" | "continuation" | "indecision";
export type TrendClassification = "HH_HL" | "LH_LL" | "CONSOLIDATION_RANGE";

/** Detailed geometric measurements of a single candlestick */
export interface CandleAnatomyMetrics {
  open: number;
  high: number;
  low: number;
  close: number;
  bodySize: number;           // Absolute body size: |Close - Open|
  bodyPct: number;            // (bodySize / totalRange) * 100
  upperWick: number;          // High - max(Open, Close)
  upperWickPct: number;       // (upperWick / totalRange) * 100
  lowerWick: number;          // min(Open, Close) - Low
  lowerWickPct: number;       // (lowerWick / totalRange) * 100
  totalRange: number;         // High - Low
  classification: CandleDirection;
  isBullish: boolean;
  isBearish: boolean;
  isDoji: boolean;
  spreadToPreviousClose?: number | null;
  spreadToPreviousClosePct?: number | null;
}

/** Individual mathematical condition evaluated deterministically */
export interface PatternCondition {
  id: string;
  label: string;
  expression: string;         // e.g. "Body > 80% of range", "Upper shadow < 2%"
  operator: ">" | "<" | ">=" | "<=" | "==";
  threshold: number | string;
  actual: number | string;
  unit: string;               // e.g. "%", "x", "₹"
  satisfied: boolean;
}

/** Deterministic pattern classification output */
export interface XRayPatternEngineResult {
  patternName: string;
  direction: PatternDirectionType;
  category: PatternCategoryType;
  confidenceScore: number;     // 0.0 - 1.0 (deterministic mathematical threshold clearance)
  confidencePct: number;       // 0 - 100
  rationale: string;           // Factual explanation why it was classified
  stopLossReference: number | null;
  conditions: PatternCondition[];
}

/** Deterministic market structure snapshot at candle's point in time */
export interface XRayMarketStructure {
  trend: TrendClassification;
  trendLabel: string;          // e.g. "Uptrend (HH/HL Sequence)", "Downtrend (LH/LL Sequence)"
  swingHighCount: number;
  swingLowCount: number;
  nearestSupport: {
    price: number;
    distance: number;
    distancePct: number;
    touches: number;
    strength: number;
  } | null;
  nearestResistance: {
    price: number;
    distance: number;
    distancePct: number;
    touches: number;
    strength: number;
  } | null;
  ema9_ema20: {
    ema9: number | null;
    ema20: number | null;
    relationship: string;      // e.g. "Bullish Fast Stack (EMA 9 > EMA 20)"
    spreadPct: number;
    isBullishStack: boolean;
  };
  sma50_sma200: {
    sma50: number | null;
    sma200: number | null;
    relationship: string;      // e.g. "Golden Cross Regime (SMA 50 > SMA 200)"
    spreadPct: number;
    isGoldenCross: boolean;
  };
  volume: {
    currentVolume: number;
    baselineAvg: number;
    rvol: number;
    volumeState: "ELEVATED" | "NORMAL" | "UNUSUALLY_LOW";
    isVolumeSpike: boolean;
    relationship: string;      // e.g. "ACCUMULATION", "DISTRIBUTION"
  };
}

/** Facts available for the candle and the local X-Ray calculation. */
export interface DataProvenance {
  sourceProvider: string;
  sourceKind: "delayed_market_data" | "historical_market_data";
  transport: "HTTP REST";
  symbol: string;
  candleTimestamp: string;
  candleIndex: number;
  calculationLocation: "browser";
  algorithms: string[];
  mode: "live" | "replay";
  limitations: string[];
}

/** Complete aggregate forensic dataset for the X-Ray Drawer */
export interface XRayInspectionData {
  symbol: string;
  candle: OHLCBar;
  timestamp: string;
  candleIndex: number;
  totalCandles: number;
  anatomy: CandleAnatomyMetrics;
  pattern: XRayPatternEngineResult;
  marketStructure: XRayMarketStructure;
  provenance: DataProvenance;
  rawSRZoneSupport: SRZone | null;
  rawSRZoneResistance: SRZone | null;
}
