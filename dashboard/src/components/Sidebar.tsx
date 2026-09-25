// src/components/Sidebar.tsx
// Watchlist panel with a dark canvas and clear active state.

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api/client";
import type { StockMeta, QuoteData } from "../types/market";

interface SidebarProps {
  stocks: StockMeta[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

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
      className={`watchlist-row w-full text-left px-4 h-14 flex items-center justify-between transition-colors duration-150 border-b border-[var(--border-subtle)] select-none outline-none ${
        isActive
          ? "bg-[var(--surface-elevated)] border-l-2 border-l-[var(--accent-primary)]"
          : "bg-transparent hover:bg-[var(--surface)] border-l-2 border-l-transparent"
      }`}
    >
      {/* Left: ticker + company name */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
        <span
          className="text-xs font-bold tracking-wide text-[var(--text-primary)] truncate"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {ticker(stock.symbol)}
        </span>
        <span
          className="text-label text-[var(--text-tertiary)] truncate"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {stock.display_name}
        </span>
      </div>

      {/* Right: price + change */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {loading ? (
          <div className="flex flex-col items-end gap-1">
            <div className="h-3 w-12 bg-[var(--surface-elevated)] rounded-sm animate-pulse" />
            <div className="h-2.5 w-8 bg-[var(--surface-elevated)] rounded-sm animate-pulse" />
          </div>
        ) : quote ? (
          <>
            <span
              className="text-xs font-semibold text-[var(--text-primary)] tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div
              className={`flex items-center gap-0.5 text-label font-medium tabular-nums ${
                positive
                  ? "text-[var(--positive)]"
                  : negative
                  ? "text-[var(--negative)]"
                  : "text-[var(--text-tertiary)]"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {positive ? (
                <TrendingUp size={10} strokeWidth={2.5} />
              ) : negative ? (
                <TrendingDown size={10} strokeWidth={2.5} />
              ) : (
                <Minus size={10} />
              )}
              <span>
                {quote.change_pct > 0 ? "+" : ""}
                {quote.change_pct.toFixed(2)}%
              </span>
            </div>
          </>
        ) : (
          <span className="text-xs text-[var(--text-disabled)] font-mono">—</span>
        )}
      </div>
    </button>
  );
}

export default function Sidebar({ stocks, activeSymbol, onSelectSymbol }: SidebarProps) {
  return (
    <aside
      className="market-watchlist shrink-0 flex flex-col min-h-0 overflow-hidden select-none border-r border-[var(--border-default)]"
      style={{
        backgroundColor: "var(--canvas)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Watchlist Header */}
      <div
        className="watchlist-header px-4 py-2.5 flex items-center justify-between border-b border-[var(--border-default)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <h2 className="text-xs font-semibold text-[var(--text-primary)] tracking-normal m-0">
          Watchlist
        </h2>
        <span className="text-label text-[var(--text-tertiary)]">
          NSE · {stocks.length}
        </span>
      </div>

      {/* Stock list */}
      <div className="watchlist-list flex-1 overflow-y-auto">
        {stocks.map((stock) => (
          <QuoteRow
            key={stock.symbol}
            stock={stock}
            isActive={stock.symbol === activeSymbol}
            onSelect={() => onSelectSymbol(stock.symbol)}
          />
        ))}
      </div>

      {/* Footer status strip */}
      <div
        className="watchlist-footer px-4 py-2 flex items-center justify-between border-t border-[var(--border-default)] text-label text-[var(--text-tertiary)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <span>Yahoo feed</span>
        <span className="tabular-nums">15m delayed</span>
      </div>
    </aside>
  );
}
