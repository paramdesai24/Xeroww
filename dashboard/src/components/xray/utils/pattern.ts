// src/components/xray/utils/pattern.ts
// Deterministic pattern classification and mathematical conditions evaluator.
// Zero AI, zero probabilistic models — 100% deterministic mathematical rules.

import type { OHLCBar } from "../../../types/market";
import type {
  CandleAnatomyMetrics,
  XRayPatternEngineResult,
} from "../../../types/xray";

/**
 * Evaluates deterministic mathematical conditions on a candle and its preceding bar.
 */
export function evaluateCandlePattern(
  _candle: OHLCBar,
  anatomy: CandleAnatomyMetrics,
  prevCandle?: OHLCBar | null
): XRayPatternEngineResult {
  const { open, high, low, close, totalRange, bodySize, upperWick, lowerWick, bodyPct, upperWickPct, lowerWickPct, isBullish, isBearish } = anatomy;

  if (totalRange <= 0) {
    return {
      patternName: "Zero Range Flat Bar",
      direction: "neutral",
      category: "indecision",
      confidenceScore: 1.0,
      confidencePct: 100,
      rationale: "Zero volatility recorded during session. High equals Low; market was illiquid or halted.",
      stopLossReference: low,
      conditions: [
        {
          id: "cond_flat_range",
          label: "Total Session Range",
          expression: "Range == 0.00",
          operator: "==",
          threshold: 0,
          actual: 0,
          unit: "₹",
          satisfied: true,
        },
      ],
    };
  }

  // 1. Bullish Marubozu Check
  const marubozuBodySatisfied = bodyPct >= 80.0;
  const marubozuUpperSatisfied = upperWickPct <= 2.5;
  const marubozuLowerSatisfied = lowerWickPct <= 2.5;

  if (isBullish && marubozuBodySatisfied && marubozuUpperSatisfied && marubozuLowerSatisfied) {
    const marginBody = Math.min(1.0, (bodyPct - 80) / 20); // 0 to 1
    const marginUpper = (2.5 - upperWickPct) / 2.5;
    const marginLower = (2.5 - lowerWickPct) / 2.5;
    const score = Math.min(0.99, 0.85 + 0.15 * ((marginBody + marginUpper + marginLower) / 3));

    return {
      patternName: "Bullish Marubozu",
      direction: "bullish",
      category: "continuation",
      confidenceScore: Number(score.toFixed(3)),
      confidencePct: Math.round(score * 100),
      rationale: `Unconditional buyer dominance from bell to bell. Real body spans ${bodyPct.toFixed(1)}% of total range with virtually nonexistent upper and lower wicks.`,
      stopLossReference: low,
      conditions: [
        {
          id: "mbz_body",
          label: "Real Body Proportion",
          expression: "Body ≥ 80.0% of range",
          operator: ">=",
          threshold: 80.0,
          actual: Number(bodyPct.toFixed(1)),
          unit: "%",
          satisfied: true,
        },
        {
          id: "mbz_upper",
          label: "Upper Shadow Cap",
          expression: "Upper Wick ≤ 2.5% of range",
          operator: "<=",
          threshold: 2.5,
          actual: Number(upperWickPct.toFixed(1)),
          unit: "%",
          satisfied: true,
        },
        {
          id: "mbz_lower",
          label: "Lower Shadow Cap",
          expression: "Lower Wick ≤ 2.5% of range",
          operator: "<=",
          threshold: 2.5,
          actual: Number(lowerWickPct.toFixed(1)),
          unit: "%",
          satisfied: true,
        },
        {
          id: "mbz_dir",
          label: "Session Polarity",
          expression: "Close > Open",
          operator: ">",
          threshold: open,
          actual: close,
          unit: "₹",
          satisfied: true,
        },
      ],
    };
  }

  // 2. Bearish Marubozu Check
  if (isBearish && marubozuBodySatisfied && marubozuUpperSatisfied && marubozuLowerSatisfied) {
    const marginBody = Math.min(1.0, (bodyPct - 80) / 20);
    const marginUpper = (2.5 - upperWickPct) / 2.5;
    const marginLower = (2.5 - lowerWickPct) / 2.5;
    const score = Math.min(0.99, 0.85 + 0.15 * ((marginBody + marginUpper + marginLower) / 3));

    return {
      patternName: "Bearish Marubozu",
      direction: "bearish",
      category: "continuation",
      confidenceScore: Number(score.toFixed(3)),
      confidencePct: Math.round(score * 100),
      rationale: `Unconditional seller liquidation across the session. Real body spans ${bodyPct.toFixed(1)}% of total range with virtually nonexistent shadows.`,
      stopLossReference: high,
      conditions: [
        {
          id: "b_mbz_body",
          label: "Real Body Proportion",
          expression: "Body ≥ 80.0% of range",
          operator: ">=",
          threshold: 80.0,
          actual: Number(bodyPct.toFixed(1)),
          unit: "%",
          satisfied: true,
        },
        {
          id: "b_mbz_upper",
          label: "Upper Shadow Cap",
          expression: "Upper Wick ≤ 2.5% of range",
          operator: "<=",
          threshold: 2.5,
          actual: Number(upperWickPct.toFixed(1)),
          unit: "%",
          satisfied: true,
        },
        {
          id: "b_mbz_lower",
          label: "Lower Shadow Cap",
          expression: "Lower Wick ≤ 2.5% of range",
          operator: "<=",
          threshold: 2.5,
          actual: Number(lowerWickPct.toFixed(1)),
          unit: "%",
          satisfied: true,
        },
        {
          id: "b_mbz_dir",
          label: "Session Polarity",
          expression: "Close < Open",
          operator: "<",
          threshold: open,
          actual: close,
          unit: "₹",
          satisfied: true,
        },
      ],
    };
  }

  // 3. Dragonfly Doji Check
  const isDojiBody = bodyPct <= 5.0;
  if (isDojiBody && upperWickPct <= 3.0 && lowerWickPct >= 65.0) {
    return {
      patternName: "Dragonfly Doji",
      direction: "bullish",
      category: "reversal",
      confidenceScore: 0.92,
      confidencePct: 92,
      rationale: "Sellers drove price aggressively lower during the session, but buyers completely recovered all losses to close directly at the session highs.",
      stopLossReference: low,
      conditions: [
        { id: "df_body", label: "Equilibrium Body", expression: "Body ≤ 5.0% of range", operator: "<=", threshold: 5.0, actual: Number(bodyPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "df_upper", label: "Upper Wick Null", expression: "Upper Wick ≤ 3.0% of range", operator: "<=", threshold: 3.0, actual: Number(upperWickPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "df_lower", label: "Extended Lower Shadow", expression: "Lower Wick ≥ 65.0% of range", operator: ">=", threshold: 65.0, actual: Number(lowerWickPct.toFixed(1)), unit: "%", satisfied: true },
      ],
    };
  }

  // 4. Gravestone Doji Check
  if (isDojiBody && lowerWickPct <= 3.0 && upperWickPct >= 65.0) {
    return {
      patternName: "Gravestone Doji",
      direction: "bearish",
      category: "reversal",
      confidenceScore: 0.91,
      confidencePct: 91,
      rationale: "Buyers attempted an aggressive upside breakout, but supply heavily overwhelmed demand to force price back down to the session open and low.",
      stopLossReference: high,
      conditions: [
        { id: "gs_body", label: "Equilibrium Body", expression: "Body ≤ 5.0% of range", operator: "<=", threshold: 5.0, actual: Number(bodyPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "gs_lower", label: "Lower Wick Null", expression: "Lower Wick ≤ 3.0% of range", operator: "<=", threshold: 3.0, actual: Number(lowerWickPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "gs_upper", label: "Extended Upper Shadow", expression: "Upper Wick ≥ 65.0% of range", operator: ">=", threshold: 65.0, actual: Number(upperWickPct.toFixed(1)), unit: "%", satisfied: true },
      ],
    };
  }

  // 5. Standard Neutral Doji Check
  if (isDojiBody) {
    return {
      patternName: "Standard Doji",
      direction: "neutral",
      category: "indecision",
      confidenceScore: 0.88,
      confidencePct: 88,
      rationale: "Absolute balance between bulls and bears. Opening and closing prints converged within 5% of total day range.",
      stopLossReference: Math.min(open, close),
      conditions: [
        { id: "doji_body", label: "Equilibrium Body", expression: "Body ≤ 5.0% of range", operator: "<=", threshold: 5.0, actual: Number(bodyPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "doji_range", label: "Active Trading Range", expression: "Range > 0.00", operator: ">", threshold: 0, actual: totalRange, unit: "₹", satisfied: true },
      ],
    };
  }

  // 6. Bullish Hammer Check (Lower wick >= 2x Body, small upper wick)
  const isHammerLower = bodySize > 0 && lowerWick >= 2.0 * bodySize;
  const isHammerUpper = upperWickPct <= 10.0;
  if (isHammerLower && isHammerUpper && bodyPct >= 10.0) {
    const ratioMultiplier = Number((lowerWick / bodySize).toFixed(2));
    const score = Math.min(0.95, 0.80 + Math.min(0.15, (ratioMultiplier - 2.0) * 0.05));
    return {
      patternName: "Hammer",
      direction: "bullish",
      category: "reversal",
      confidenceScore: Number(score.toFixed(3)),
      confidencePct: Math.round(score * 100),
      rationale: `Sharp intraday rejection of lower levels. The lower shadow is ${ratioMultiplier}x the real body height with upper wick under 10% of range.`,
      stopLossReference: low,
      conditions: [
        { id: "hmr_lower", label: "Lower Shadow Dominance", expression: "Lower Wick ≥ 2.0x Body", operator: ">=", threshold: "2.0x", actual: `${ratioMultiplier}x`, unit: "x", satisfied: true },
        { id: "hmr_upper", label: "Upper Shadow Cap", expression: "Upper Wick ≤ 10.0% of range", operator: "<=", threshold: 10.0, actual: Number(upperWickPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "hmr_body", label: "Defined Body", expression: "Body ≥ 10.0% of range", operator: ">=", threshold: 10.0, actual: Number(bodyPct.toFixed(1)), unit: "%", satisfied: true },
      ],
    };
  }

  // 7. Shooting Star Check (Upper wick >= 2x Body, small lower wick)
  const isStarUpper = bodySize > 0 && upperWick >= 2.0 * bodySize;
  const isStarLower = lowerWickPct <= 10.0;
  if (isStarUpper && isStarLower && bodyPct >= 10.0) {
    const ratioMultiplier = Number((upperWick / bodySize).toFixed(2));
    const score = Math.min(0.95, 0.80 + Math.min(0.15, (ratioMultiplier - 2.0) * 0.05));
    return {
      patternName: "Shooting Star",
      direction: "bearish",
      category: "reversal",
      confidenceScore: Number(score.toFixed(3)),
      confidencePct: Math.round(score * 100),
      rationale: `Aggressive price rejection at upper extremes. Upper shadow is ${ratioMultiplier}x the real body height with session closing near the lows.`,
      stopLossReference: high,
      conditions: [
        { id: "star_upper", label: "Upper Shadow Dominance", expression: "Upper Wick ≥ 2.0x Body", operator: ">=", threshold: "2.0x", actual: `${ratioMultiplier}x`, unit: "x", satisfied: true },
        { id: "star_lower", label: "Lower Shadow Cap", expression: "Lower Wick ≤ 10.0% of range", operator: "<=", threshold: 10.0, actual: Number(lowerWickPct.toFixed(1)), unit: "%", satisfied: true },
        { id: "star_body", label: "Defined Body", expression: "Body ≥ 10.0% of range", operator: ">=", threshold: 10.0, actual: Number(bodyPct.toFixed(1)), unit: "%", satisfied: true },
      ],
    };
  }

  // 8. Multi-candle: Bullish Engulfing Check
  if (prevCandle && isBullish && prevCandle.close < prevCandle.open) {
    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    const engulfsHigh = close >= prevCandle.open;
    const engulfsLow = open <= prevCandle.close;
    if (engulfsHigh && engulfsLow && bodySize > prevBody) {
      return {
        patternName: "Bullish Engulfing",
        direction: "bullish",
        category: "reversal",
        confidenceScore: 0.94,
        confidencePct: 94,
        rationale: "Current bullish candle completely engulfs the prior bearish candle's real body, signifying sudden demand overhang.",
        stopLossReference: Math.min(low, prevCandle.low),
        conditions: [
          { id: "eng_prior", label: "Prior Bearish Bar", expression: "Prior Close < Prior Open", operator: "<", threshold: prevCandle.open, actual: prevCandle.close, unit: "₹", satisfied: true },
          { id: "eng_top", label: "Engulfs Open", expression: "Current Close ≥ Prior Open", operator: ">=", threshold: prevCandle.open, actual: close, unit: "₹", satisfied: true },
          { id: "eng_bottom", label: "Engulfs Close", expression: "Current Open ≤ Prior Close", operator: "<=", threshold: prevCandle.close, actual: open, unit: "₹", satisfied: true },
        ],
      };
    }
  }

  // 9. Multi-candle: Bearish Engulfing Check
  if (prevCandle && isBearish && prevCandle.close > prevCandle.open) {
    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    const engulfsHigh = open >= prevCandle.close;
    const engulfsLow = close <= prevCandle.open;
    if (engulfsHigh && engulfsLow && bodySize > prevBody) {
      return {
        patternName: "Bearish Engulfing",
        direction: "bearish",
        category: "reversal",
        confidenceScore: 0.94,
        confidencePct: 94,
        rationale: "Current bearish bar completely engulfs the prior bullish candle's body, demonstrating immediate liquidity absorption by sellers.",
        stopLossReference: Math.max(high, prevCandle.high),
        conditions: [
          { id: "b_eng_prior", label: "Prior Bullish Bar", expression: "Prior Close > Prior Open", operator: ">", threshold: prevCandle.open, actual: prevCandle.close, unit: "₹", satisfied: true },
          { id: "b_eng_top", label: "Engulfs Close", expression: "Current Open ≥ Prior Close", operator: ">=", threshold: prevCandle.close, actual: open, unit: "₹", satisfied: true },
          { id: "b_eng_bottom", label: "Engulfs Open", expression: "Current Close ≤ Prior Open", operator: "<=", threshold: prevCandle.open, actual: close, unit: "₹", satisfied: true },
        ],
      };
    }
  }

  // 10. Default / Standard Trend Impulse Bar
  const isExpansion = bodyPct >= 50.0;
  const patternName = isExpansion
    ? isBullish
      ? "Bullish Expansion Bar"
      : "Bearish Expansion Bar"
    : isBullish
    ? "Bullish Session Bar"
    : "Bearish Session Bar";

  const confidenceScore = Number((0.70 + (bodyPct / 100) * 0.15).toFixed(2));

  return {
    patternName,
    direction: isBullish ? "bullish" : "bearish",
    category: isExpansion ? "continuation" : "indecision",
    confidenceScore,
    confidencePct: Math.round(confidenceScore * 100),
    rationale: `Session formed a ${isBullish ? "bullish" : "bearish"} impulse body accounting for ${bodyPct.toFixed(1)}% of range. Wick ratio: ${(upperWickPct + lowerWickPct).toFixed(1)}%.`,
    stopLossReference: isBullish ? low : high,
    conditions: [
      {
        id: "exp_body",
        label: "Body Proportion",
        expression: "Body > 80% of range",
        operator: ">",
        threshold: 80.0,
        actual: Number(bodyPct.toFixed(1)),
        unit: "%",
        satisfied: bodyPct > 80.0,
      },
      {
        id: "exp_upper",
        label: "Upper Shadow Cap",
        expression: "Upper shadow < 2%",
        operator: "<",
        threshold: 2.0,
        actual: Number(upperWickPct.toFixed(1)),
        unit: "%",
        satisfied: upperWickPct < 2.0,
      },
      {
        id: "exp_lower",
        label: "Lower Shadow Cap",
        expression: "Lower shadow < 2%",
        operator: "<",
        threshold: 2.0,
        actual: Number(lowerWickPct.toFixed(1)),
        unit: "%",
        satisfied: lowerWickPct < 2.0,
      },
      {
        id: "exp_dir",
        label: "Directional Close",
        expression: isBullish ? "Close > Open" : "Close < Open",
        operator: isBullish ? ">" : "<",
        threshold: open,
        actual: close,
        unit: "₹",
        satisfied: true,
      },
    ],
  };
}
