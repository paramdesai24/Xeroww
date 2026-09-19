import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../config";
import { api, storeTokens } from "./client";

describe("API client contracts", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("defaults to the edge /api path", () => {
    expect(config.apiBaseUrl).toBe("/api");
  });

  it("uses PATCH for partial journal updates", async () => {
    storeTokens("access-token", "refresh-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 7, status: "CLOSED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.journal.updateStatus(7, "CLOSED");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/journal/7",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("uses the canonical decisions endpoint for previews", async () => {
    storeTokens("access-token", "refresh-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ resolved_as_of: "2026-01-20" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.decisions.preview({
      symbol: "RELIANCE.NS",
      direction: "BULLISH",
      intent: "WATCH",
      holding_period: "SWING",
      setup_type: "Structure review",
      confidence: 3,
      thesis: "Evidence warrants continued observation.",
      change_mind_condition: "Structure becomes decisively bearish.",
      source_context: "MARKET",
      source_period: "1y",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decisions/preview",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
