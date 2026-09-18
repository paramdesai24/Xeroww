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
});
