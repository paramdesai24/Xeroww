import { describe, expect, it } from "vitest";
import { readMarketPaneLayout } from "./useMarketPaneLayout";

describe("Market pane layout storage", () => {
  it("uses defaults for missing, corrupt, and incompatible preferences", () => {
    const standard = readMarketPaneLayout(null);
    expect(readMarketPaneLayout("not json")).toEqual(standard);
    expect(readMarketPaneLayout(JSON.stringify({ version: 2 }))).toEqual(standard);
    expect(readMarketPaneLayout(JSON.stringify({ version: 1, watchlistWidth: "wide", analyticsWidth: 400, collapsed: {} }))).toEqual(standard);
  });

  it("keeps valid collapsed flags and clamps undersized widths", () => {
    expect(readMarketPaneLayout(JSON.stringify({
      version: 1, watchlistWidth: 20, analyticsWidth: 50,
      collapsed: { watchlist: true, center: false, analytics: true },
    }))).toEqual({
      watchlistWidth: 180,
      analyticsWidth: 280,
      collapsed: { watchlist: true, center: false, analytics: true },
    });
  });
});
