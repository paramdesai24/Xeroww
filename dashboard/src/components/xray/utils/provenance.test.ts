import { describe, expect, it } from "vitest";
import { generateDataProvenance } from "./provenance";

describe("generateDataProvenance", () => {
  it("reports the actual delayed provider and local calculation boundary", () => {
    const result = generateDataProvenance(
      "RELIANCE.NS",
      { time: "2026-01-05", open: 100, high: 105, low: 98, close: 104, volume: 1000 },
      4,
      "replay",
    );

    expect(result.sourceProvider).toContain("Yahoo Finance");
    expect(result.transport).toBe("HTTP REST");
    expect(result.calculationLocation).toBe("browser");
    expect(result.mode).toBe("replay");
    expect(JSON.stringify(result)).not.toMatch(/partition|offset|direct feed|ingestionLatency/i);
  });
});
