// src/api/client.ts
// Typed API client — all fetch calls to the Xeroww FastAPI backend.
// V0.6: Auth-aware — attaches Bearer token when available.

import type { StockMeta, QuoteData, OHLCData, PatternData, HealthStatus } from "../types/market";
import type {
  Watchlist,
  Portfolio,
  PortfolioSummary,
  Transaction,
  Alert,
  AlertEvaluationResult,
  JournalEntry,
} from "../types/platform";
import type { TokenResponse, UserProfile } from "../types/auth";
import config from "../config";

const BASE_URL = config.apiBaseUrl;

// Token storage keys
export const TOKEN_KEY = "xeroww_access_token";
export const REFRESH_KEY = "xeroww_refresh_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Base fetch with optional auth
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : JSON.stringify(error.detail) ?? `API error ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const authFetch = <T>(path: string, options: RequestInit = {}) =>
  apiFetch<T>(path, options, true);

export const api = {
  // -------------------------------------------------------------------------
  // V0.5 — Market data (preserved, no auth required)
  // -------------------------------------------------------------------------
  health: (): Promise<HealthStatus> => apiFetch<HealthStatus>("/health"),

  getStocks: (): Promise<StockMeta[]> => apiFetch<StockMeta[]>("/stocks"),

  getQuote: (symbol: string): Promise<QuoteData> =>
    apiFetch<QuoteData>(`/quote/${encodeURIComponent(symbol)}`),

  getOHLC: (symbol: string, period = "1mo", interval = "1d"): Promise<OHLCData> =>
    apiFetch<OHLCData>(
      `/ohlc/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`,
    ),

  getPatterns: (symbol: string): Promise<PatternData> =>
    apiFetch<PatternData>(`/patterns/${encodeURIComponent(symbol)}`),

  // -------------------------------------------------------------------------
  // V0.6 — Authentication
  // -------------------------------------------------------------------------
  auth: {
    register: (name: string, email: string, password: string): Promise<TokenResponse> =>
      apiFetch<TokenResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }),

    login: (email: string, password: string): Promise<TokenResponse> =>
      apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),

    me: (): Promise<UserProfile> => authFetch<UserProfile>("/auth/me"),

    refresh: (refreshToken: string): Promise<TokenResponse> =>
      apiFetch<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),

    logout: (): Promise<void> =>
      authFetch<void>("/auth/logout", { method: "POST" }),
  },

  // -------------------------------------------------------------------------
  // V0.6 — Watchlists
  // -------------------------------------------------------------------------
  watchlists: {
    list: (): Promise<Watchlist[]> => authFetch<Watchlist[]>("/watchlists"),

    get: (id: number): Promise<Watchlist> => authFetch<Watchlist>(`/watchlists/${id}`),

    create: (name: string): Promise<Watchlist> =>
      authFetch<Watchlist>("/watchlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),

    rename: (id: number, name: string): Promise<Watchlist> =>
      authFetch<Watchlist>(`/watchlists/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),

    delete: (id: number): Promise<void> =>
      authFetch<void>(`/watchlists/${id}`, { method: "DELETE" }),

    addSymbol: (id: number, symbol: string) =>
      authFetch(`/watchlists/${id}/symbols`, {
        method: "POST",
        body: JSON.stringify({ symbol }),
      }),

    removeSymbol: (id: number, symbol: string): Promise<void> =>
      authFetch<void>(`/watchlists/${id}/symbols/${encodeURIComponent(symbol)}`, {
        method: "DELETE",
      }),
  },

  // -------------------------------------------------------------------------
  // V0.6 — Portfolios
  // -------------------------------------------------------------------------
  portfolios: {
    list: (): Promise<Portfolio[]> => authFetch<Portfolio[]>("/portfolios"),

    get: (id: number): Promise<PortfolioSummary> =>
      authFetch<PortfolioSummary>(`/portfolios/${id}`),

    create: (name: string): Promise<Portfolio> =>
      authFetch<Portfolio>("/portfolios", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),

    trade: (
      portfolioId: number,
      symbol: string,
      side: "BUY" | "SELL",
      quantity: number,
      limitPrice?: number,
    ): Promise<Transaction> =>
      authFetch<Transaction>(`/portfolios/${portfolioId}/trade`, {
        method: "POST",
        body: JSON.stringify({
          symbol,
          side,
          quantity,
          limit_price: limitPrice ?? null,
        }),
      }),

    transactions: (id: number): Promise<Transaction[]> =>
      authFetch<Transaction[]>(`/portfolios/${id}/transactions`),
  },

  // -------------------------------------------------------------------------
  // V0.6 — Alerts
  // -------------------------------------------------------------------------
  alerts: {
    list: (): Promise<Alert[]> => authFetch<Alert[]>("/alerts"),

    create: (symbol: string, alertType: string, conditionPayload: Record<string, unknown>): Promise<Alert> =>
      authFetch<Alert>("/alerts", {
        method: "POST",
        body: JSON.stringify({
          symbol,
          alert_type: alertType,
          condition_payload: conditionPayload,
        }),
      }),

    delete: (id: number): Promise<void> =>
      authFetch<void>(`/alerts/${id}`, { method: "DELETE" }),

    evaluate: (id: number): Promise<AlertEvaluationResult> =>
      authFetch<AlertEvaluationResult>(`/alerts/${id}/evaluate`, { method: "POST" }),

    evaluateAll: (): Promise<AlertEvaluationResult[]> =>
      authFetch<AlertEvaluationResult[]>("/alerts/evaluate-all", { method: "POST" }),
  },

  // -------------------------------------------------------------------------
  // V0.6 — Decision Journal
  // -------------------------------------------------------------------------
  journal: {
    list: (): Promise<JournalEntry[]> => authFetch<JournalEntry[]>("/journal"),

    create: (
      symbol: string,
      action: string,
      thesis: string,
      contextSnapshot: Record<string, unknown> = {},
    ): Promise<JournalEntry> =>
      authFetch<JournalEntry>("/journal", {
        method: "POST",
        body: JSON.stringify({
          symbol,
          action,
          thesis,
          context_snapshot: contextSnapshot,
        }),
      }),

    updateStatus: (id: number, status: string, thesis?: string): Promise<JournalEntry> =>
      authFetch<JournalEntry>(`/journal/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, thesis }),
      }),
  },
};
