// src/api/systemHealth.ts
// Typed API client functions for Xeroww SRE System Health & Topology Console.

import type { SystemHealthSnapshot } from "../types/health";
import config from "../config";

const BASE_URL = config.apiBaseUrl;

export async function fetchSystemHealth(): Promise<SystemHealthSnapshot> {
  const res = await fetch(`${BASE_URL}/health/system`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown network error");
    throw new Error(`HTTP ${res.status}: Failed to fetch system health telemetry (${errorText})`);
  }

  return res.json();
}
