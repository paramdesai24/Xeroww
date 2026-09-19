// src/config.ts
// Central frontend configuration — all environment-specific values live here.
// Change VITE_API_URL in .env to point to staging/production API.

const config = {
  // Backend API base URL
  // Override with VITE_API_URL env variable in .env
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "/api",

  // Default chart settings
  chart: {
    defaultPeriod: "1mo" as const,
    defaultInterval: "1d" as const,
    colors: {
      background: "#000000",
      gridLines: "#1A1A1A",
      text: "#6B6B72",
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUp: "#22C55E",
      borderDown: "#EF4444",
      wickUp: "#22C55E",
      wickDown: "#EF4444",
      crosshair: "#3B82F6",
    },
  },

  // Watchlist display names — keeps UI labels decoupled from API symbols
  watchlistMeta: {
    "RELIANCE.NS": { shortName: "RELIANCE", sector: "Energy" },
    "TCS.NS":      { shortName: "TCS",      sector: "IT" },
    "INFY.NS":     { shortName: "INFY",     sector: "IT" },
    "HDFCBANK.NS": { shortName: "HDFC",     sector: "Banking" },
    "ICICIBANK.NS":{ shortName: "ICICI",    sector: "Banking" },
  } as Record<string, { shortName: string; sector: string }>,

  // App metadata
  app: {
    name: "Xeroww",
    version: import.meta.env.VITE_APP_VERSION ?? "0.9.0",
    dataNote: "Near real-time data — Yahoo Finance delayed feed",
  },
} as const;

export default config;
