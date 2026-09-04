// src/components/Sidebar.tsx
// Watchlist panel — institutional terminal style with 68px rows and subtle 1px border.

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api/client";
import type { StockMeta, QuoteData } from "../types/market";

interface SidebarProps {
  stocks: StockMeta[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

// Strip the .NS suffix for clean terminal ticker display
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
      className={`w-full text-left px-4 h-[68px] flex items-center justify-between transition-all duration-[180ms] ease-out group ${
        isActive
          ? "bg-[#111111] border-l border-[#6366F1]"
          : "border-l border-transparent hover:bg-[#111111]/70"
      }`}
    >
      {/* Left: Larger stock symbol with muted company name below */}
      <div className="flex flex-col justify-center min-w-0 pr-2">
        <span
          className={`text-base font-semibold tracking-wider transition-colors duration-[180ms] ${
            isActive ? "text-[#FAFAFA]" : "text-[#FAFAFA] group-hover:text-white"
          }`}
        >
          {ticker(stock.symbol)}
        </span>
        <span className="text-[11px] text-[#A1A1AA] mt-0.5 truncate max-w-[125px]">
          {stock.display_name}
        </span>
      </div>

      {/* Right: Price aligned right, percentage change below price */}
      <div className="text-right shrink-0 flex flex-col justify-center items-end">
        {loading ? (
          <div className="space-y-1.5 w-16 flex flex-col items-end">
            <div className="h-3.5 w-14 bg-[#171717] rounded animate-pulse" />
            <div className="h-3 w-10 bg-[#171717] rounded animate-pulse" />
          </div>
        ) : quote ? (
          <>
            <span className="text-sm font-mono font-medium text-[#FAFAFA] tabular-nums">
              ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <div
              className={`flex items-center gap-0.5 text-[11px] font-mono font-medium mt-0.5 tabular-nums ${
                positive
                  ? "text-[#22C55E]"
                  : negative
                  ? "text-[#EF4444]"
                  : "text-[#A1A1AA]"
              }`}
            >
              {positive ? (
                <TrendingUp size={10} className="stroke-[2.5]" />
              ) : negative ? (
                <TrendingDown size={10} className="stroke-[2.5]" />
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
          <span className="text-xs font-mono text-[#A1A1AA]">—</span>
        )}
      </div>
    </button>
  );
}

export default function Sidebar({ stocks, activeSymbol, onSelectSymbol }: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 bg-[#0A0A0A] border-r border-[#262626] flex flex-col overflow-hidden select-none">
      {/* Watchlist Header */}
      <div className="px-4 py-2.5 border-b border-[#262626] flex items-center justify-between bg-[#0A0A0A]">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#A1A1AA]">
          Watchlist
        </h2>
        <span className="text-[10px] font-mono text-[#737373]">
          NSE · {stocks.length}
        </span>
      </div>

      {/* Stock list: ~68px rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#171717]">
        {stocks.map((stock) => (
          <QuoteRow
            key={stock.symbol}
            stock={stock}
            isActive={stock.symbol === activeSymbol}
            onSelect={() => onSelectSymbol(stock.symbol)}
          />
        ))}
      </div>

      {/* Terminal metadata footer */}
      <div className="px-4 py-2 border-t border-[#262626] bg-[#0A0A0A]">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#737373]">
          <span>FEED: YAHOO</span>
          <span>DELAY ~15M</span>
        </div>
      </div>
    </aside>
  );
}
