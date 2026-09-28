import { describe, expect, it } from "vitest";
import type { OHLCData } from "../../types/market";
import { chartCandles } from "./chartCandles";

const base: OHLCData = {
  symbol: "RELIANCE.NS", display_name: "Reliance Industries", period: "1d", interval: "5m", data_note: "Delayed data",
  candles: [
    { time: "2026-09-28", chart_time: 1790566800, open: 100, high: 103, low: 99, close: 102, volume: 10 },
    { time: "2026-09-28", chart_time: 1790567100, open: 102, high: 104, low: 101, close: 103, volume: 12 },
  ],
};

describe("chartCandles", () => {
  it("keeps distinct intraday bars using their UTC timestamps", () => {
    expect(chartCandles(base).map((item) => item.time)).toEqual([1790566800, 1790567100]);
  });

  it("combines legacy same-day bars when timestamps are unavailable", () => {
    const legacy = { ...base, candles: base.candles.map(({ chart_time: _chartTime, ...bar }) => bar) };
    const bars = chartCandles(legacy);
    expect(bars).toHaveLength(1);
    expect(bars[0].bar).toMatchObject({ open: 100, high: 104, low: 99, close: 103, volume: 22 });
  });
});
