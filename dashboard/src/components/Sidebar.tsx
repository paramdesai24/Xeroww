// src/components/Sidebar.tsx
// Watchlist panel — lists all tracked stocks with live price and % change.

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { StockMeta, QuoteData } from "../types/market";

interface SidebarProps {
  stocks: StockMeta[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

// Strip the .NS suffix for display
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
      className={`w-full text-left px-4 py-3 transition-all duration-150 group border-l-2 ${
        isActive
          ? "bg-indigo-500/10 border-indigo-500"
          : "border-transparent hover:bg-slate-800/60 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span
            className={`text-sm font-bold tracking-wide ${isActive ? "text-indigo-300" : "text-slate-200 group-hover:text-white"}`}
          >
            {ticker(stock.symbol)}
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[110px]">
            {stock.display_name}
          </p>
        </div>

        {loading ? (
          <RefreshCw size={12} className="text-slate-600 animate-spin" />
        ) : quote ? (
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-100">
              ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <div
              className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${
                positive ? "text-emerald-400" : negative ? "text-red-400" : "text-slate-500"
              }`}
            >
              {positive ? <TrendingUp size={11} /> : negative ? <TrendingDown size={11} /> : <Minus size={11} />}
              {quote.change_pct > 0 ? "+" : ""}
              {quote.change_pct.toFixed(2)}%
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </div>
    </button>
  );
}

export default function Sidebar({ stocks, activeSymbol, onSelectSymbol }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-[#0D1117] border-r border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Watchlist
        </h2>
        <p className="text-[10px] text-slate-600 mt-0.5">NSE · {stocks.length} stocks</p>
      </div>

      {/* Stock list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {stocks.map((stock) => (
          <QuoteRow
            key={stock.symbol}
            stock={stock}
            isActive={stock.symbol === activeSymbol}
            onSelect={() => onSelectSymbol(stock.symbol)}
          />
        ))}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-slate-800">
        <p className="text-[9px] text-slate-600 leading-relaxed">
          Prices delayed ~15–20 min
          <br />
          Yahoo Finance · Xeroww V0
        </p>
      </div>
    </aside>
  );
}
