import type { Time, UTCTimestamp } from "lightweight-charts";
import type { OHLCBar, OHLCData } from "../../types/market";

export interface ChartCandle {
  bar: OHLCBar;
  time: Time;
}

export function chartCandles(ohlc: OHLCData | null): ChartCandle[] {
  if (!ohlc?.candles.length) return [];
  const intraday = /^\d+[mh]$/i.test(ohlc.interval);
  const byTime = new Map<string, ChartCandle>();

  for (const bar of ohlc.candles) {
    const timestamp = intraday && Number.isFinite(bar.chart_time) ? bar.chart_time : null;
    const time = timestamp != null ? timestamp as UTCTimestamp : bar.time as Time;
    const key = String(time);
    const previous = byTime.get(key);
    if (previous && timestamp == null) {
      byTime.set(key, {
        time,
        bar: {
          ...bar,
          open: previous.bar.open,
          high: Math.max(previous.bar.high, bar.high),
          low: Math.min(previous.bar.low, bar.low),
          volume: previous.bar.volume + bar.volume,
        },
      });
    } else {
      byTime.set(key, { time, bar });
    }
  }

  return Array.from(byTime.values()).sort((left, right) => {
    if (typeof left.time === "number" && typeof right.time === "number") return left.time - right.time;
    return String(left.time).localeCompare(String(right.time));
  });
}
