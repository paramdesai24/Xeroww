import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("analytical feature API", () => {
  it("encodes the symbol and sends an explicit UTC range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ symbol: "RELIANCE.NS", start_time: "2026-09-29T00:00:00Z", end_time: "2026-09-30T00:00:00Z", count: 0, data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.analytics.getFeatures(
      " reliance.ns ",
      new Date("2026-09-29T00:00:00Z"),
      new Date("2026-09-30T00:00:00Z"),
      250,
    );

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/analytics/features/RELIANCE.NS?");
    expect(url).toContain("start_time=2026-09-29T00%3A00%3A00.000Z");
    expect(url).toContain("end_time=2026-09-30T00%3A00%3A00.000Z");
    expect(url).toContain("limit=250");
  });

  it.each([
    ["", new Date("2026-09-29T00:00:00Z"), new Date("2026-09-30T00:00:00Z"), 500],
    ["AAPL", new Date("invalid"), new Date("2026-09-30T00:00:00Z"), 500],
    ["AAPL", new Date("2026-09-30T00:00:00Z"), new Date("2026-09-29T00:00:00Z"), 500],
    ["AAPL", new Date("2026-09-29T00:00:00Z"), new Date("2026-09-30T00:00:00Z"), 5001],
  ])("does not fetch for an invalid bounded query", async (symbol, start, end, limit) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.analytics.getFeatures(symbol as string, start as Date, end as Date, limit as number)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
