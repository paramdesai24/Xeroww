// src/components/xray/utils/provenance.ts
// Truthful provenance for deterministic calculations performed in the browser.

import type { OHLCBar } from "../../../types/market";
import type { DataProvenance } from "../../../types/xray";

/**
 * Describes only data and calculations that actually exist in the current runtime.
 */
export function generateDataProvenance(
  symbol: string,
  candle: OHLCBar,
  candleIndex = 0,
  mode: "live" | "replay" = "live",
): DataProvenance {
  return {
    sourceProvider: "Yahoo Finance delayed feed",
    sourceKind: mode === "replay" ? "historical_market_data" : "delayed_market_data",
    transport: "HTTP REST",
    symbol,
    candleTimestamp: String(candle.time),
    candleIndex,
    calculationLocation: "browser",
    algorithms: ["CANDLE-ANATOMY-V1", "PATTERN-RULES-V1", "STRUCTURE-CONTEXT-V1"],
    mode,
    limitations: [
      "Not a live exchange feed.",
      "X-Ray values are derived from the candle history currently loaded in the browser.",
      "Kafka transport and durable lineage are future architecture, not active runtime telemetry.",
    ],
  };
}
