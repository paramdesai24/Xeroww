import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../config";
import { api, storeTokens } from "./client";
import { AppError } from "./errors";

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

  it("formats backend validation errors without exposing JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        detail: [{ type: "int_parsing", loc: ["path", "session_id"], msg: "Input should be a valid integer" }],
      }), { status: 422, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.replayLab.get(Number.NaN)).rejects.toMatchObject({
      title: "Check your input",
      fieldErrors: { session_id: "Input should be a valid integer" },
    } satisfies Partial<AppError>);
  });

  it("formats network failures with a recovery message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.health()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Check your connection and try again.",
    } satisfies Partial<AppError>);
  });
});
