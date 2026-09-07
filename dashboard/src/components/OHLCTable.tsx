// src/components/OHLCTable.tsx
// Recent session history table — graphite-and-paper design system.
// Compact terminal table displaying the 10 most recent OHLC daily sessions.

import type { OHLCBar } from "../types/market";

interface OHLCTableProps {
  candles: OHLCBar[] | undefined;
  selectedDate?: string | null;
  onSelectCandle?: (candle: OHLCBar) => void;
}

export default function OHLCTable({ candles, selectedDate, onSelectCandle }: OHLCTableProps) {
  if (!candles || candles.length === 0) return null;

  const recent10 = candles.slice(-10).reverse();

  const headerStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-disabled)",
    padding: "5px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{
      backgroundColor: "var(--surface-base)",
      borderTop: "1px solid var(--border-subtle)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      maxHeight: 160,
      overflow: "hidden",
      userSelect: "none",
      fontFamily: "var(--font-mono)",
    }}>
      {/* Header strip */}
      <div style={{
        padding: "5px 12px",
        backgroundColor: "var(--surface-base)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
            Recent Sessions
          </span>
          <span style={{ fontSize: 9, color: "var(--text-disabled)" }}>
            Last 10 days · click row for anatomy
          </span>
        </div>
        <span style={{ fontSize: 9, color: "var(--text-disabled)" }}>NSE Regular Trading</span>
      </div>

      {/* Table */}
      <div style={{ overflowY: "auto", overflowX: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--surface-base)", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ ...headerStyle, textAlign: "left" }}>Date</th>
              <th style={headerStyle}>Open</th>
              <th style={headerStyle}>High</th>
              <th style={headerStyle}>Low</th>
              <th style={headerStyle}>Close</th>
              <th style={headerStyle}>Change</th>
            </tr>
          </thead>
          <tbody>
            {recent10.map((c) => {
              const isBullish = c.close >= c.open;
              const isSelected = selectedDate === c.time;
              const change = c.close - c.open;
              const changePct = c.open > 0 ? (change / c.open) * 100 : 0;
              const dirColor = isBullish ? "var(--positive)" : "var(--negative)";

              return (
                <tr
                  key={c.time}
                  onClick={() => onSelectCandle && onSelectCandle(c)}
                  style={{
                    height: 26,
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--surface-overlay)" : "transparent",
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background-color 160ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <td style={{ padding: "0 12px", fontSize: 10, color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {c.time}
                  </td>
                  <td style={{ padding: "0 12px", textAlign: "right", fontSize: 10, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    ₹{c.open.toFixed(2)}
                  </td>
                  <td style={{ padding: "0 12px", textAlign: "right", fontSize: 10, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    ₹{c.high.toFixed(2)}
                  </td>
                  <td style={{ padding: "0 12px", textAlign: "right", fontSize: 10, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    ₹{c.low.toFixed(2)}
                  </td>
                  <td style={{ padding: "0 12px", textAlign: "right", fontSize: 10, fontWeight: 600, color: dirColor, fontVariantNumeric: "tabular-nums" }}>
                    ₹{c.close.toFixed(2)}
                  </td>
                  <td style={{ padding: "0 12px", textAlign: "right", fontSize: 9, fontWeight: 500, color: dirColor, fontVariantNumeric: "tabular-nums" }}>
                    {change >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
