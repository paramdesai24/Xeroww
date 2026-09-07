// src/components/OHLCStats.tsx
// Session Analytics panel — graphite-and-paper design system.

import { ArrowUp, ArrowDown } from "lucide-react";
import type { OHLCData, QuoteData } from "../types/market";

interface OHLCStatsProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
}

function StatRow({ label, value, highlight }: {
  label: string;
  value: string;
  highlight?: "bull" | "bear" | null;
}) {
  const valueColor = highlight === "bull"
    ? "var(--positive)"
    : highlight === "bear"
    ? "var(--negative)"
    : "var(--text-primary)";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "5px 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: valueColor, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low;
  const pct = range > 0 ? Math.min(Math.max(((current - low) / range) * 100, 0), 100) : 50;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        color: "var(--text-tertiary)",
        marginBottom: 5,
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>₹{low.toFixed(1)}</span>
        <span style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 8 }}>Session Range</span>
        <span>₹{high.toFixed(1)}</span>
      </div>
      <div style={{ position: "relative", height: 4, backgroundColor: "var(--border-subtle)", borderRadius: 2 }}>
        {/* Low end marker */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, backgroundColor: "var(--negative)", borderRadius: "2px 0 0 2px" }} />
        {/* High end marker */}
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, backgroundColor: "var(--positive)", borderRadius: "0 2px 2px 0" }} />
        {/* Current price pin */}
        <div style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "var(--text-primary)",
          border: "1.5px solid var(--surface-base)",
          left: `calc(${pct}% - 4px)`,
          transition: "left 300ms cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
    </div>
  );
}

export default function OHLCStats({ quote, ohlc }: OHLCStatsProps) {
  const latest = ohlc?.candles.at(-1) ?? null;
  const bodySize = latest ? Math.abs(latest.close - latest.open) : null;
  const dailyReturn = latest && latest.open > 0 ? ((latest.close - latest.open) / latest.open) * 100 : null;

  return (
    <div style={{
      padding: 12,
      backgroundColor: "var(--surface-raised)",
      border: "1px solid var(--border-subtle)",
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
        <h3 style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          margin: 0,
        }}>
          Session Analytics
        </h3>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
          {latest ? latest.time : "DAILY"}
        </span>
      </div>

      {quote && latest ? (
        <>
          <RangeBar low={quote.day_low} high={quote.day_high} current={quote.price} />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
            <StatRow label="Open" value={`₹${latest.open.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
            <StatRow label="High" value={`₹${quote.day_high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
            <StatRow label="Low" value={`₹${quote.day_low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
            <StatRow label="Close" value={`₹${latest.close.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
            {bodySize !== null && (
              <StatRow label="Body Size" value={`₹${bodySize.toFixed(2)}`} />
            )}
            {dailyReturn !== null && (
              <StatRow
                label="Daily Return"
                value={`${dailyReturn >= 0 ? "+" : ""}${dailyReturn.toFixed(2)}%`}
                highlight={dailyReturn > 0 ? "bull" : dailyReturn < 0 ? "bear" : null}
              />
            )}
            <StatRow label="Volume" value={quote.volume.toLocaleString("en-IN")} />
            {quote.market_cap && (
              <StatRow label="Market Cap" value={`₹${(quote.market_cap / 1e12).toFixed(2)}T`} />
            )}
          </div>

          {/* 1-Month Range */}
          {ohlc && ohlc.candles.length > 0 && (() => {
            const highs = ohlc.candles.map((c) => c.high);
            const lows = ohlc.candles.map((c) => c.low);
            const monthHigh = Math.max(...highs);
            const monthLow = Math.min(...lows);
            return (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-disabled)",
                  marginBottom: 6,
                }}>
                  <span>1M Range</span>
                  <span>Low / High</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--negative)" }}>
                    <ArrowDown size={10} strokeWidth={2.5} />
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{monthLow.toFixed(1)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--positive)" }}>
                    <ArrowUp size={10} strokeWidth={2.5} />
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{monthHigh.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <div style={{
          padding: "20px 0",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.08em",
          color: "var(--text-disabled)",
          textTransform: "uppercase",
        }}>
          Awaiting quote…
        </div>
      )}
    </div>
  );
}
