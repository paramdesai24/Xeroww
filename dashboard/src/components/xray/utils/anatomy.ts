// src/components/xray/utils/anatomy.ts
// Geometric breakdown and anatomical measurements of individual candlesticks.

import type { OHLCBar } from "../../../types/market";
import type { CandleAnatomyMetrics, CandleDirection } from "../../../types/xray";

/**
 * Computes deep geometric anatomy of an individual OHLC candle.
 */
export function calculateCandleAnatomy(
  candle: OHLCBar,
  prevCandle?: OHLCBar | null
): CandleAnatomyMetrics {
  const open = candle.open;
  const high = candle.high;
  const low = candle.low;
  const close = candle.close;

  const totalRange = Math.max(0.0, high - low);
  const bodySize = Math.abs(close - open);
  const upperWick = Math.max(0.0, high - Math.max(open, close));
  const lowerWick = Math.max(0.0, Math.min(open, close) - low);

  const bodyPct = totalRange > 0 ? (bodySize / totalRange) * 100 : 0;
  const upperWickPct = totalRange > 0 ? (upperWick / totalRange) * 100 : 0;
  const lowerWickPct = totalRange > 0 ? (lowerWick / totalRange) * 100 : 0;

  const isBullish = close > open;
  const isBearish = close < open;
  const isDoji = totalRange > 0 ? bodyPct <= 5.0 : close === open;

  let classification: CandleDirection = "NEUTRAL_DOJI";
  if (!isDoji) {
    classification = isBullish ? "BULLISH" : "BEARISH";
  }

  let spreadToPreviousClose: number | null = null;
  let spreadToPreviousClosePct: number | null = null;
  if (prevCandle && prevCandle.close > 0) {
    spreadToPreviousClose = close - prevCandle.close;
    spreadToPreviousClosePct = (spreadToPreviousClose / prevCandle.close) * 100;
  }

  return {
    open: Number(open.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    close: Number(close.toFixed(2)),
    bodySize: Number(bodySize.toFixed(2)),
    bodyPct: Number(bodyPct.toFixed(1)),
    upperWick: Number(upperWick.toFixed(2)),
    upperWickPct: Number(upperWickPct.toFixed(1)),
    lowerWick: Number(lowerWick.toFixed(2)),
    lowerWickPct: Number(lowerWickPct.toFixed(1)),
    totalRange: Number(totalRange.toFixed(2)),
    classification,
    isBullish,
    isBearish,
    isDoji,
    spreadToPreviousClose: spreadToPreviousClose !== null ? Number(spreadToPreviousClose.toFixed(2)) : null,
    spreadToPreviousClosePct: spreadToPreviousClosePct !== null ? Number(spreadToPreviousClosePct.toFixed(2)) : null,
  };
}
