// src/components/CandleAnatomy.tsx
// Candle anatomy breakdown — graphite-and-paper design system.

import type { OHLCBar } from "../types/market";

interface CandleAnatomyProps {
  candle: OHLCBar | null;
  isLatest?: boolean;
}

export default function CandleAnatomy({ candle, isLatest = false }: CandleAnatomyProps) {
  if (!candle) {
    return (
      <div style={{
        padding: 12,
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: 8,
        }}>
          <h3 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            margin: 0,
          }}>
            Candle Anatomy
          </h3>
        </div>
        <div style={{
          padding: "20px 0",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.08em",
          color: "var(--text-disabled)",
          textTransform: "uppercase",
        }}>
          Select a candle on chart…
        </div>
      </div>
    );
  }

  const bodySize = Math.abs(candle.close - candle.open);
  const upperShadow = Math.max(candle.high - Math.max(candle.open, candle.close), 0);
  const lowerShadow = Math.max(Math.min(candle.open, candle.close) - candle.low, 0);
  const totalRange = candle.high - candle.low;
  const bodyRatio = totalRange > 0 ? (bodySize / totalRange) * 100 : 0;
  const wickRatio = totalRange > 0 ? ((upperShadow + lowerShadow) / totalRange) * 100 : 0;
  const isBullish = candle.close >= candle.open;

  return (
    <div style={{
      padding: 12,
      backgroundColor: "var(--surface-raised)",
      border: "1px solid var(--border-subtle)",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 8,
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <h3 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            margin: 0,
          }}>
            Candle Anatomy
          </h3>
          {isLatest && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Latest
            </span>
          )}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {candle.time}
        </span>
      </div>

      {/* OHLC values */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 10 }}>
        {[
          { label: "OPEN", value: candle.open.toFixed(2), color: "var(--text-primary)" },
          { label: "HIGH", value: candle.high.toFixed(2), color: "var(--text-primary)" },
          { label: "LOW",  value: candle.low.toFixed(2),  color: "var(--text-primary)" },
          { label: "CLOSE", value: candle.close.toFixed(2), color: isBullish ? "var(--positive)" : "var(--negative)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 3,
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
              {label}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, color, fontVariantNumeric: "tabular-nums" }}>
              ₹{value}
            </span>
          </div>
        ))}
      </div>

      {/* Structural Metrics */}
      <div style={{
        padding: 8,
        backgroundColor: "var(--surface-inset)",
        border: "1px solid var(--border-subtle)",
        marginBottom: 10,
      }}>
        {[
          { label: "Body Size", value: `₹${bodySize.toFixed(2)}` },
          { label: "Upper Shadow", value: `₹${upperShadow.toFixed(2)}` },
          { label: "Lower Shadow", value: `₹${lowerShadow.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 0",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>{label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Ratio Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Body Ratio */}
        <div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}>
            <span>Body Ratio</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {bodyRatio.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 3, backgroundColor: "var(--border-subtle)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(bodyRatio, 100)}%`,
              backgroundColor: isBullish ? "var(--positive)" : "var(--negative)",
              borderRadius: 1,
              transition: "width 180ms cubic-bezier(0.16,1,0.3,1)",
            }} />
          </div>
        </div>

        {/* Wick Ratio */}
        <div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}>
            <span>Wick Ratio</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {wickRatio.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 3, backgroundColor: "var(--border-subtle)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(wickRatio, 100)}%`,
              backgroundColor: "var(--accent)",
              borderRadius: 1,
              transition: "width 180ms cubic-bezier(0.16,1,0.3,1)",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
