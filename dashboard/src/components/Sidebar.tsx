import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api/client";
import type { StockMeta, QuoteData, QuoteSnapshot } from "../types/market";

interface SidebarProps {
  stocks: StockMeta[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onCollapse?: () => void;
}

const SNAPSHOT_TTL_MS = 60_000;
let cached: { key: string; value: QuoteSnapshot; at: number } | null = null;
let pending: { key: string; promise: Promise<QuoteSnapshot> } | null = null;

function readSnapshot(symbols: string[], force: boolean): Promise<QuoteSnapshot> {
  const key = symbols.join(",");
  if (!force && cached?.key === key && Date.now() - cached.at < SNAPSHOT_TTL_MS) return Promise.resolve(cached.value);
  if (pending?.key === key) return pending.promise;
  const promise = api.getQuotes(symbols).then((value) => {
    cached = { key, value, at: Date.now() };
    return value;
  }).finally(() => { if (pending?.promise === promise) pending = null; });
  pending = { key, promise };
  return promise;
}

function QuoteRow({ stock, quote, loading, isActive, onSelect }: {
  stock: StockMeta;
  quote: QuoteData | null;
  loading: boolean;
  isActive: boolean;
  onSelect: () => void;
}) {
  const positive = (quote?.change_pct ?? 0) > 0;
  const negative = (quote?.change_pct ?? 0) < 0;
  return <button onClick={onSelect} className={`watchlist-row w-full text-left px-4 h-14 flex items-center justify-between transition-colors duration-150 border-b border-[var(--border-subtle)] select-none outline-none ${isActive ? "bg-[var(--surface-elevated)] border-l-2 border-l-[var(--accent-primary)]" : "bg-transparent hover:bg-[var(--surface)] border-l-2 border-l-transparent"}`}>
    <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
      <span className="text-xs font-bold tracking-wide text-[var(--text-primary)] truncate">{stock.symbol.replace(/\.NS$/i, "")}</span>
      <span className="text-label text-[var(--text-tertiary)] truncate">{stock.display_name}</span>
    </div>
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      {quote ? <>
        <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className={`flex items-center gap-0.5 text-label font-medium tabular-nums ${positive ? "text-[var(--positive)]" : negative ? "text-[var(--negative)]" : "text-[var(--text-tertiary)]"}`} style={{ fontFamily: "var(--font-mono)" }}>
          {positive ? <TrendingUp size={10} /> : negative ? <TrendingDown size={10} /> : <Minus size={10} />}
          {quote.change_pct > 0 ? "+" : ""}{quote.change_pct.toFixed(2)}%
        </span>
      </> : loading ? <span className="h-3 w-14 bg-[var(--surface-elevated)] animate-pulse" aria-label="Loading quote" /> : <span className="text-label text-[var(--text-tertiary)]">Unavailable</span>}
    </div>
  </button>;
}

export default function Sidebar({ stocks, activeSymbol, onSelectSymbol, onCollapse }: SidebarProps) {
  const [snapshot, setSnapshot] = useState<QuoteSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const symbols = useMemo(() => stocks.map((stock) => stock.symbol), [stocks]);
  const key = symbols.join(",");
  useEffect(() => {
    if (!key) return;
    let current = true;
    queueMicrotask(() => setRefreshing(true));
    readSnapshot(symbols, reload > 0).then((value) => {
      if (current) { setSnapshot(value); setError(false); }
    }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setRefreshing(false); });
    return () => { current = false; };
  }, [key, reload, symbols]);
  const quotes = useMemo(() => new Map(snapshot?.rows.map((row) => [row.symbol, row.quote]) ?? []), [snapshot]);

  return <aside id="market-watchlist-content" className="market-watchlist shrink-0 flex flex-col min-h-0 overflow-hidden select-none border-r border-[var(--border-default)]" style={{ backgroundColor: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
    <div className="watchlist-header px-4 py-2.5 flex items-center justify-between border-b border-[var(--border-default)]" style={{ backgroundColor: "var(--surface)" }}>
      <h2 className="text-xs font-semibold text-[var(--text-primary)] tracking-normal m-0">Watchlist</h2>
      <div className="watchlist-header__actions">
        <button className="type-label text-[var(--text-tertiary)]" disabled={refreshing || !symbols.length} onClick={() => setReload((value) => value + 1)} title={error ? "Retry quotes" : "Refresh quotes"}>{refreshing ? "Loading" : error ? "Retry" : `NSE · ${stocks.length}`}</button>
        {onCollapse && <button className="market-pane__collapse" type="button" aria-label="Hide Watchlist" aria-controls="market-watchlist-content" aria-expanded={true} title="Hide Watchlist" onClick={onCollapse}>×</button>}
      </div>
    </div>
    <div className="watchlist-list flex-1 overflow-y-auto">
      {stocks.map((stock) => <QuoteRow key={stock.symbol} stock={stock} quote={quotes.get(stock.symbol) ?? null} loading={!snapshot && refreshing} isActive={stock.symbol === activeSymbol} onSelect={() => onSelectSymbol(stock.symbol)} />)}
    </div>
    <div className="watchlist-footer px-4 py-2 flex items-center justify-between border-t border-[var(--border-default)] text-label text-[var(--text-tertiary)]" style={{ backgroundColor: "var(--surface)" }}>
      <span>{error ? "Quotes unavailable" : "Yahoo feed"}</span><span className="tabular-nums">15m delayed</span>
    </div>
  </aside>;
}
