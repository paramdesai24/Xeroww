// src/api/client.ts
// Typed API client — all fetch calls to the Xeroww FastAPI backend.
// Change BASE_URL to point to production API when deploying.

import type { StockMeta, QuoteData, OHLCData, PatternData, HealthStatus } from "../types/market";
import config from "../config";

const BASE_URL = config.apiBaseUrl;

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (): Promise<HealthStatus> =>
    apiFetch<HealthStatus>("/health"),

  getStocks: (): Promise<StockMeta[]> =>
    apiFetch<StockMeta[]>("/stocks"),

  getQuote: (symbol: string): Promise<QuoteData> =>
    apiFetch<QuoteData>(`/quote/${encodeURIComponent(symbol)}`),

  getOHLC: (symbol: string, period = "1mo", interval = "1d"): Promise<OHLCData> =>
    apiFetch<OHLCData>(`/ohlc/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`),

  getPatterns: (symbol: string): Promise<PatternData> =>
    apiFetch<PatternData>(`/patterns/${encodeURIComponent(symbol)}`),
};
