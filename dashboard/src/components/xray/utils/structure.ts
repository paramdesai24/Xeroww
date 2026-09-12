// src/components/xray/utils/structure.ts
// Market structure analytics: HH/HL trend classification, S/R distance, MA relationships, RVOL.

import type { OHLCBar } from "../../../types/market";
import type { MarketStructureSummaryResponse, SRZone } from "../../../types/structure";
import type { TrendClassification, XRayMarketStructure } from "../../../types/xray";

/**
 * Calculates exponential moving average for a slice of closing prices.
 */
function calculateEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return Number(ema.toFixed(2));
}

/**
 * Calculates simple moving average for a slice of closing prices.
 */
function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const sum = window.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Classifies swing sequence (HH/HL vs LH/LL) from historical bars up to candleIndex.
 */
function detectSwingStructure(
  candles: OHLCBar[],
  currentIndex: number
): { trend: TrendClassification; trendLabel: string; highCount: number; lowCount: number } {
  // Use up to 30 prior bars to detect local swing pivots (window +/- 2)
  const lookbackStart = Math.max(0, currentIndex - 35);
  const slice = candles.slice(lookbackStart, currentIndex + 1);

  if (slice.length < 5) {
    return {
      trend: "CONSOLIDATION_RANGE",
      trendLabel: "Consolidation / Insufficient History",
      highCount: 0,
      lowCount: 0,
    };
  }

  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < slice.length - 1; i++) {
    const bar = slice[i];
    const prev1 = slice[i - 1];
    const prev2 = slice[i - 2];
    const next1 = slice[i + 1];

    if (bar.high >= prev1.high && bar.high >= prev2.high && bar.high >= next1.high) {
      swingHighs.push(bar.high);
    }
    if (bar.low <= prev1.low && bar.low <= prev2.low && bar.low <= next1.low) {
      swingLows.push(bar.low);
    }
  }

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    const lastLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];

    const isHH = lastHigh > prevHigh;
    const isHL = lastLow > prevLow;
    const isLH = lastHigh < prevHigh;
    const isLL = lastLow < prevLow;

    if (isHH && isHL) {
      return {
        trend: "HH_HL",
        trendLabel: "Uptrend (HH/HL Sequence)",
        highCount: swingHighs.length,
        lowCount: swingLows.length,
      };
    }
    if (isLH && isLL) {
      return {
        trend: "LH_LL",
        trendLabel: "Downtrend (LH/LL Sequence)",
        highCount: swingHighs.length,
        lowCount: swingLows.length,
      };
    }
  }

  // Fallback to recent 10-bar slope
  const firstClose = slice[0].close;
  const currentClose = slice[slice.length - 1].close;
  const slopePct = firstClose > 0 ? ((currentClose - firstClose) / firstClose) * 100 : 0;

  if (slopePct >= 2.0) {
    return {
      trend: "HH_HL",
      trendLabel: "Impulse Advance (Bullish Bias)",
      highCount: swingHighs.length,
      lowCount: swingLows.length,
    };
  }
  if (slopePct <= -2.0) {
    return {
      trend: "LH_LL",
      trendLabel: "Impulse Decline (Bearish Bias)",
      highCount: swingHighs.length,
      lowCount: swingLows.length,
    };
  }

  return {
    trend: "CONSOLIDATION_RANGE",
    trendLabel: "Neutral Range / Mixed Swings",
    highCount: swingHighs.length,
    lowCount: swingLows.length,
  };
}

/**
 * Computes market structure context for a selected candle.
 */
export function calculateMarketStructureContext(
  candle: OHLCBar,
  allCandles: OHLCBar[],
  candleIndex: number,
  structureResponse?: MarketStructureSummaryResponse | null
): { marketStructure: XRayMarketStructure; rawSupport: SRZone | null; rawResistance: SRZone | null } {
  const close = candle.close;
  const volume = candle.volume ?? 0;

  // Slices up to current candle for point-in-time accuracy
  const slice = allCandles.slice(0, candleIndex + 1);
  const closes = slice.map((c) => c.close);
  const volumes = slice.map((c) => c.volume ?? 0);

  // 1. Swing Trend
  const { trend, trendLabel, highCount, lowCount } = detectSwingStructure(allCandles, candleIndex);

  // 2. Support & Resistance
  let nearestSupport: XRayMarketStructure["nearestSupport"] = null;
  let nearestResistance: XRayMarketStructure["nearestResistance"] = null;
  let rawSupport: SRZone | null = null;
  let rawResistance: SRZone | null = null;

  if (structureResponse?.support_resistance) {
    const supports = structureResponse.support_resistance.support_zones || [];
    const resistances = structureResponse.support_resistance.resistance_zones || [];

    // Find nearest support strictly below or at close
    const validSupports = supports.filter((s) => s.price <= close);
    if (validSupports.length > 0) {
      validSupports.sort((a, b) => Math.abs(close - a.price) - Math.abs(close - b.price));
      const s = validSupports[0];
      rawSupport = s;
      const dist = Math.abs(close - s.price);
      nearestSupport = {
        price: Number(s.price.toFixed(2)),
        distance: Number(dist.toFixed(2)),
        distancePct: Number(((dist / close) * 100).toFixed(2)),
        touches: s.touches,
        strength: s.strength,
      };
    }

    // Find nearest resistance strictly above or at close
    const validResistances = resistances.filter((r) => r.price >= close);
    if (validResistances.length > 0) {
      validResistances.sort((a, b) => Math.abs(close - a.price) - Math.abs(close - b.price));
      const r = validResistances[0];
      rawResistance = r;
      const dist = Math.abs(r.price - close);
      nearestResistance = {
        price: Number(r.price.toFixed(2)),
        distance: Number(dist.toFixed(2)),
        distancePct: Number(((dist / close) * 100).toFixed(2)),
        touches: r.touches,
        strength: r.strength,
      };
    }
  }

  // Fallback S/R calculation if backend structure not loaded yet
  if (!nearestSupport && slice.length > 5) {
    const priorLows = slice.slice(-20, -1).map((c) => c.low).filter((l) => l < close);
    if (priorLows.length > 0) {
      const supPrice = Math.max(...priorLows);
      const dist = close - supPrice;
      nearestSupport = {
        price: Number(supPrice.toFixed(2)),
        distance: Number(dist.toFixed(2)),
        distancePct: Number(((dist / close) * 100).toFixed(2)),
        touches: 2,
        strength: 5,
      };
    }
  }

  if (!nearestResistance && slice.length > 5) {
    const priorHighs = slice.slice(-20, -1).map((c) => c.high).filter((h) => h > close);
    if (priorHighs.length > 0) {
      const resPrice = Math.min(...priorHighs);
      const dist = resPrice - close;
      nearestResistance = {
        price: Number(resPrice.toFixed(2)),
        distance: Number(dist.toFixed(2)),
        distancePct: Number(((dist / close) * 100).toFixed(2)),
        touches: 2,
        strength: 5,
      };
    }
  }

  // 3. Moving Averages
  const ema9 = calculateEMA(closes, 9);
  const ema20 = calculateEMA(closes, 20);
  let emaSpreadPct = 0;
  let emaRelationship = "Fast MAs Initializing";
  let isBullishStack = false;

  if (ema9 !== null && ema20 !== null) {
    emaSpreadPct = Number((((ema9 - ema20) / ema20) * 100).toFixed(2));
    isBullishStack = ema9 >= ema20;
    emaRelationship = isBullishStack
      ? `Bullish Stack (EMA 9 > EMA 20, +${emaSpreadPct}%)`
      : `Bearish Cross (EMA 9 < EMA 20, ${emaSpreadPct}%)`;
  }

  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  let smaSpreadPct = 0;
  let smaRelationship = "Macro MAs Calculating";
  let isGoldenCross = false;

  if (sma50 !== null && sma200 !== null) {
    smaSpreadPct = Number((((sma50 - sma200) / sma200) * 100).toFixed(2));
    isGoldenCross = sma50 >= sma200;
    smaRelationship = isGoldenCross
      ? `Golden Cross Stack (SMA 50 > SMA 200, +${smaSpreadPct}%)`
      : `Death Cross Regime (SMA 50 < SMA 200, ${smaSpreadPct}%)`;
  } else if (sma50 !== null) {
    smaRelationship = close >= sma50 ? "Above SMA 50 Baseline" : "Below SMA 50 Baseline";
  }

  // 4. Volume & RVOL
  const baselineWindow = volumes.slice(-21, -1);
  const baselineAvg = baselineWindow.length > 0
    ? baselineWindow.reduce((a, b) => a + b, 0) / baselineWindow.length
    : volume;
  const rvol = baselineAvg > 0 ? Number((volume / baselineAvg).toFixed(2)) : 1.0;

  const isVolumeSpike = rvol >= 1.75;
  const volumeState = rvol >= 1.3 ? "ELEVATED" : rvol <= 0.65 ? "UNUSUALLY_LOW" : "NORMAL";

  const isUp = candle.close >= candle.open;
  const relationship = isVolumeSpike
    ? isUp ? "ACCUMULATION SPIKE" : "DISTRIBUTION SPIKE"
    : isUp && rvol >= 1.0 ? "ACCUMULATION" : !isUp && rvol >= 1.0 ? "DISTRIBUTION" : "NEUTRAL FLOW";

  return {
    marketStructure: {
      trend,
      trendLabel,
      swingHighCount: highCount,
      swingLowCount: lowCount,
      nearestSupport,
      nearestResistance,
      ema9_ema20: {
        ema9,
        ema20,
        relationship: emaRelationship,
        spreadPct: emaSpreadPct,
        isBullishStack,
      },
      sma50_sma200: {
        sma50,
        sma200,
        relationship: smaRelationship,
        spreadPct: smaSpreadPct,
        isGoldenCross,
      },
      volume: {
        currentVolume: volume,
        baselineAvg: Math.round(baselineAvg),
        rvol,
        volumeState,
        isVolumeSpike,
        relationship,
      },
    },
    rawSupport,
    rawResistance,
  };
}
