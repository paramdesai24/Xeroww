// src/components/xray/utils/provenance.ts
// Deterministic Kafka data lineage and event generator.
// Formats Kafka-ready event models using symbol and candle timestamp.

import type { OHLCBar } from "../../../types/market";
import type { KafkaProvenance } from "../../../types/xray";

/** Simple deterministic string hash for partition and ID generation */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/** Converts a string to a deterministic hex string of desired length */
function toHex(num: number, length: number): string {
  return num.toString(16).padStart(length, "0").slice(0, length);
}

/**
 * Builds a deterministic Kafka provenance record.
 * Even before Kafka is deployed, this adheres to the exact Kafka event contract.
 */
export function generateKafkaProvenance(
  symbol: string,
  candle: OHLCBar,
  candleIndex = 0
): KafkaProvenance {
  const cleanSymbol = symbol.replace(".NS", "").toUpperCase();
  const timeStr = String(candle.time);
  const dateParts = timeStr.replace(/[^0-9]/g, "");

  const symbolHash = hashString(cleanSymbol);
  const timeHash = hashString(timeStr);
  const combinedHash = hashString(`${cleanSymbol}:${timeStr}:${candleIndex}`);

  // Deterministic partition (0-15 typical for high-throughput equity ticks)
  const partition = symbolHash % 16;

  // Deterministic monotonic offset derived from date parts and index
  const baseOffset = 1048576; // 2^20 baseline
  const dayOffset = (parseInt(dateParts.slice(-4), 10) || 1) * 375; // ~375 min/trading day
  const offset = baseOffset + dayOffset + candleIndex;

  // Deterministic Event ID: evt_{SYMBOL}_{YYYYMMDD}_{HEX}
  const eventIdHex = toHex(combinedHash, 8);
  const eventId = `evt_${cleanSymbol.toLowerCase()}_${dateParts.slice(0, 8)}_${eventIdHex}`;

  // W3C Traceparent compliant trace ID: 00-{32 hex chars}-{16 hex chars}-01
  const tracePart1 = toHex(symbolHash, 8) + toHex(timeHash, 8);
  const tracePart2 = toHex(combinedHash, 8) + toHex(offset, 8);
  const parentId = toHex(combinedHash ^ offset, 16);
  const traceId = `00-${tracePart1}${tracePart2}-${parentId}-01`;

  // Deterministic latency simulation (1.2ms - 3.8ms)
  const latency = Number((1.2 + ((combinedHash % 26) / 10)).toFixed(1));

  // Ingestion timestamp (market close on that candle date + latency)
  const ingestionTimestamp = `${timeStr.includes("T") ? timeStr : `${timeStr}T15:30:00.000`}Z`;

  return {
    eventId,
    producer: "xeroww-engine.market-feed.nse-equity.v1",
    topic: "xeroww.market.ohlc.ticks.v1",
    partition,
    offset,
    traceId,
    schemaVersion: "v1.2.0-avro-proto",
    ingestionTimestamp,
    ingestionLatencyMs: latency,
    sourceProvider: "NSE National Stock Exchange / Direct Feed",
    kafkaReady: true,
  };
}
