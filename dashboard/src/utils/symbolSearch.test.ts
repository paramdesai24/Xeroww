import { describe, expect, it } from "vitest";
import type { StockMeta } from "../types/market";
import { searchSymbols } from "./symbolSearch";

const stocks: StockMeta[] = [
  { symbol: "MARUTI.NS", display_name: "Maruti Suzuki India", exchange: "NSE", sector: "Automobiles" },
  { symbol: "RELIANCE.NS", display_name: "Reliance Industries", exchange: "NSE", sector: "Energy" },
  { symbol: "POWERGRID.NS", display_name: "Power Grid Corporation", exchange: "NSE", sector: "Utilities" },
  { symbol: "RVNL.NS", display_name: "Rail Vikas Nigam", exchange: "NSE", sector: "Infrastructure" },
];

describe("searchSymbols", () => {
  it("ranks company-name prefixes before contains matches", () => {
    expect(searchSymbols(stocks, "r").map((stock) => stock.symbol)).toEqual([
      "RVNL.NS",
      "RELIANCE.NS",
      "MARUTI.NS",
      "POWERGRID.NS",
    ]);
  });

  it("matches ticker text and escapes regex characters", () => {
    expect(searchSymbols(stocks, "power")[0]?.symbol).toBe("POWERGRID.NS");
    expect(searchSymbols(stocks, "[")).toEqual([]);
  });
});
