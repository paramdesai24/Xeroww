import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api/client";
import type { StockMeta } from "../types/market";
import { searchSymbols } from "../utils/symbolSearch";
import CompanyLogo from "./market/CompanyLogo";

const RECENT_KEY = "xeroww:recent-stocks";

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").filter((item: unknown) => typeof item === "string").slice(0, 5); }
  catch { return []; }
}

export default function GlobalSearch({ onOpenSymbol }: { onOpenSymbol: (symbol: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const matches = useMemo(() => searchSymbols(stocks, query, 8), [stocks, query]);
  const recentStocks = useMemo(() => recent.map((symbol) => stocks.find((stock) => stock.symbol === symbol)).filter(Boolean) as StockMeta[], [recent, stocks]);
  const options = query.trim() ? matches : recentStocks;

  useEffect(() => { api.getStocks().then(setStocks).catch(() => setStocks([])); }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (stock: StockMeta) => {
    const next = [stock.symbol, ...recent.filter((item) => item !== stock.symbol)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next); setQuery(""); setOpen(false); setActive(0); onOpenSymbol(stock.symbol);
  };

  return <div className="global-search" ref={root}>
    <Search size={15} aria-hidden="true" />
    <input role="combobox" aria-label="Search stocks" aria-expanded={open && options.length > 0} aria-controls="global-search-results" value={query} placeholder="Search stocks" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown" && options.length) { event.preventDefault(); setActive((value) => (value + 1) % options.length); }
      if (event.key === "ArrowUp" && options.length) { event.preventDefault(); setActive((value) => (value - 1 + options.length) % options.length); }
      if (event.key === "Enter" && options[active]) { event.preventDefault(); choose(options[active]); }
      if (event.key === "Escape") setOpen(false);
    }} />
    {open && options.length > 0 && <div className="global-search__results" id="global-search-results" role="listbox">
      {!query.trim() && <span className="global-search__label">Recent searches</span>}
      {options.map((stock, index) => <button key={stock.symbol} role="option" aria-selected={index === active} className={index === active ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(stock)}>
        <CompanyLogo symbol={stock.symbol} size="small" /><strong>{stock.symbol.replace(".NS", "")}</strong><span>{stock.display_name}</span><small>{stock.exchange}</small>
      </button>)}
    </div>}
  </div>;
}
