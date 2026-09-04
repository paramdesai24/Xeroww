// src/config.ts
// Central frontend configuration — all environment-specific values live here.
// Change VITE_API_URL in .env to point to staging/production API.

const config = {
  // Backend API base URL
  // Override with VITE_API_URL env variable in .env
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",

  // Default chart settings
  chart: {
    defaultPeriod: "1mo" as const,
    defaultInterval: "1d" as const,
    colors: {
      background: "#0D1117",
      gridLines: "#1c2333",
      text: "#8b949e",
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUp: "#16a34a",
      borderDown: "#dc2626",
      wickUp: "#22c55e",
      wickDown: "#ef4444",
      crosshair: "#4b5563",
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
    version: "0.1.0",
    dataNote: "Near real-time data — Yahoo Finance delayed feed",
  },
} as const;

export default config;
