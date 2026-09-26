import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarketData } from "./useMarketData";

const market = vi.hoisted(() => ({
  getStocks: vi.fn(),
  getQuote: vi.fn(),
  getOHLC: vi.fn(),
  getPatterns: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock("../api/client", () => ({ api: {
  getStocks: market.getStocks,
  getQuote: market.getQuote,
  getOHLC: market.getOHLC,
  getPatterns: market.getPatterns,
  marketStructure: { getSummary: market.getSummary },
} }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  market.getStocks.mockResolvedValue([]);
  market.getQuote.mockImplementation(async (symbol: string) => ({ symbol }));
  market.getPatterns.mockResolvedValue(null);
  market.getSummary.mockResolvedValue(null);
});

describe("useMarketData", () => {
  it("does not request market data on another module", () => {
    renderHook(() => useMarketData("RELIANCE.NS", false));
    expect(market.getQuote).not.toHaveBeenCalled();
    expect(market.getStocks).not.toHaveBeenCalled();
  });

  it("keeps the routed symbol's bars after an older request resolves", async () => {
    let finishOld: ((value: unknown) => void) | undefined;
    market.getOHLC.mockImplementation((symbol: string) => symbol === "RELIANCE.NS"
      ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve({ symbol, candles: [{ time: "2026-09-25", close: 100 }] }));
    const view = renderHook(({ symbol }) => useMarketData(symbol, true), { initialProps: { symbol: "RELIANCE.NS" } });
    await waitFor(() => expect(finishOld).toBeDefined());
    view.rerender({ symbol: "DRREDDY.NS" });
    await waitFor(() => expect(view.result.current.ohlc?.symbol).toBe("DRREDDY.NS"));
    finishOld?.({ symbol: "RELIANCE.NS", candles: [{ time: "2026-09-24", close: 50 }] });
    await waitFor(() => expect(view.result.current.ohlc?.symbol).toBe("DRREDDY.NS"));
  });
});
