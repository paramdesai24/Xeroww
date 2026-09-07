// src/components/Sidebar.tsx
// Watchlist panel — graphite-and-paper design system.
// Stock rows are the unit of work here; everything else recedes.

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api/client";
import type { StockMeta, QuoteData } from "../types/market";

interface SidebarProps {
  stocks: StockMeta[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

// Strip the .NS suffix for clean ticker display
function ticker(symbol: string): string {
  return symbol.replace(".NS", "");
}

function QuoteRow({
  stock,
  isActive,
  onSelect,
}: {
  stock: StockMeta;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getQuote(stock.symbol)
      .then(setQuote)
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, [stock.symbol]);

  const positive = (quote?.change_pct ?? 0) > 0;
  const negative = (quote?.change_pct ?? 0) < 0;

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "0 16px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isActive ? "var(--surface-overlay)" : "transparent",
        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer",
        transition: "background-color 160ms cubic-bezier(0.16,1,0.3,1)",
        outline: "none",
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      {/* Left: ticker + company name */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1, paddingRight: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: isActive ? "var(--text-primary)" : "var(--text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {ticker(stock.symbol)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            color: "var(--text-tertiary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 120,
          }}
        >
          {stock.display_name}
        </span>
      </div>

      {/* Right: price + change */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ height: 12, width: 52, backgroundColor: "var(--surface-overlay)", borderRadius: 2 }} />
            <div style={{ height: 10, width: 36, backgroundColor: "var(--surface-overlay)", borderRadius: 2 }} />
          </div>
        ) : quote ? (
          <>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontVariantNumeric: "tabular-nums",
                color: positive ? "var(--positive)" : negative ? "var(--negative)" : "var(--text-tertiary)",
              }}
            >
              {positive ? (
                <TrendingUp size={9} strokeWidth={2.5} />
              ) : negative ? (
                <TrendingDown size={9} strokeWidth={2.5} />
              ) : (
                <Minus size={9} />
              )}
              <span>
                {quote.change_pct > 0 ? "+" : ""}
                {quote.change_pct.toFixed(2)}%
              </span>
            </div>
          </>
        ) : (
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-disabled)" }}>—</span>
        )}
      </div>
    </button>
  );
}

export default function Sidebar({ stocks, activeSymbol, onSelectSymbol }: SidebarProps) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        backgroundColor: "var(--surface-base)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Watchlist Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            margin: 0,
          }}
        >
          Watchlist
        </h2>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-disabled)",
          }}
        >
          NSE · {stocks.length}
        </span>
      </div>

      {/* Stock list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {stocks.map((stock) => (
          <QuoteRow
            key={stock.symbol}
            stock={stock}
            isActive={stock.symbol === activeSymbol}
            onSelect={() => onSelectSymbol(stock.symbol)}
          />
        ))}
      </div>

      {/* Footer metadata */}
      <div
        style={{
          padding: "6px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
          FEED: YAHOO
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
          DELAY ~15M
        </span>
      </div>
    </aside>
  );
}
