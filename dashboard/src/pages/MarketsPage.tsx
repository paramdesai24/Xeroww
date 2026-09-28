import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import MoverPanel from "../components/market/MoverPanel";
import Sparkline from "../components/market/Sparkline";
import SectorTreemap from "../components/market/SectorTreemap";
import { useMarketUniverse } from "../hooks/useMarketUniverse";
import { DataTable, Pill, SectionHeader, Surface, Toolbar } from "../components/ui";
import CompanyLogo from "../components/market/CompanyLogo";

type SortKey = "symbol" | "price" | "change" | "volume";
type QuickFilter = "ALL" | "NIFTY" | "BANKING" | "IT" | "PHARMA" | "ENERGY";

const QUICK_FILTERS: Array<{ id: QuickFilter; label: string; sectorPattern?: RegExp }> = [
  { id: "ALL", label: "All" },
  { id: "NIFTY", label: "NIFTY 50" },
  { id: "BANKING", label: "Banking", sectorPattern: /bank|financial/i },
  { id: "IT", label: "IT", sectorPattern: /information technology|technology|software|^it$/i },
  { id: "PHARMA", label: "Pharma", sectorPattern: /pharma|healthcare|drug/i },
  { id: "ENERGY", label: "Energy", sectorPattern: /energy|oil|gas|power/i },
];

export default function MarketsPage() {
  const navigate = useNavigate();
  const market = useMarketUniverse();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("ALL");
  const [direction, setDirection] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("change");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const metadata = useMemo(() => new Map(market.stocks.map((stock) => [stock.symbol, stock])), [market.stocks]);
  const sectors = useMemo(() => Array.from(new Set(market.stocks.map((stock) => stock.sector).filter(Boolean))).sort(), [market.stocks]);
  const filteredQuotes = useMemo(() => market.quotes.filter((quote) => {
    const stock = metadata.get(quote.symbol);
    const matchesQuery = `${quote.symbol} ${stock?.display_name ?? quote.display_name}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesSector = sector === "ALL" || (stock?.sector || "Other") === sector;
    const quickPattern = QUICK_FILTERS.find((filter) => filter.id === quickFilter)?.sectorPattern;
    const matchesQuickFilter = !quickPattern || quickPattern.test(stock?.sector ?? "");
    const matchesDirection = direction === "ALL" || (direction === "GAINERS" ? quote.change_pct > 0 : quote.change_pct < 0);
    return matchesQuery && matchesSector && matchesQuickFilter && matchesDirection;
  }), [market.quotes, metadata, query, sector, quickFilter, direction]);
  const rows = useMemo(() => filteredQuotes.slice().sort((left, right) => {
    if (sort === "symbol") return left.symbol.localeCompare(right.symbol);
    if (sort === "price") return right.price - left.price;
    if (sort === "volume") return right.volume - left.volume;
    return right.change_pct - left.change_pct;
  }), [filteredQuotes, sort]);
  const gainers = useMemo(() => filteredQuotes.filter((quote) => quote.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct).slice(0, 5), [filteredQuotes]);
  const losers = useMemo(() => filteredQuotes.filter((quote) => quote.change_pct < 0).sort((a, b) => a.change_pct - b.change_pct).slice(0, 5), [filteredQuotes]);
  const active = useMemo(() => filteredQuotes.slice().sort((a, b) => b.volume - a.volume).slice(0, 5), [filteredQuotes]);
  const sectorReturns = useMemo(() => {
    const groups = new Map<string, { changes: number[]; weights: number[] }>();
    const availableCaps = filteredQuotes.map((quote) => quote.market_cap).filter((cap): cap is number => cap != null && Number.isFinite(cap) && cap > 0);
    const fallbackWeight = availableCaps.length ? availableCaps.reduce((sum, cap) => sum + cap, 0) / availableCaps.length : 1;
    filteredQuotes.forEach((quote) => {
      const name = metadata.get(quote.symbol)?.sector || "Other";
      const group = groups.get(name) ?? { changes: [], weights: [] };
      group.changes.push(quote.change_pct);
      group.weights.push(quote.market_cap != null && Number.isFinite(quote.market_cap) && quote.market_cap > 0 ? quote.market_cap : fallbackWeight);
      groups.set(name, group);
    });
    return Array.from(groups, ([name, group]) => ({ name, change: group.changes.reduce((sum, value) => sum + value, 0) / group.changes.length, weight: group.weights.reduce((sum, value) => sum + value, 0) })).sort((a, b) => b.weight - a.weight).slice(0, 8);
  }, [filteredQuotes, metadata]);

  return <main className="markets-page">
    <header className="markets-page__header"><div><h1>Markets</h1><p>Scan NIFTY 50 leadership, participation, liquidity, and sector direction.</p></div><span>{market.asOf ? `As of ${new Date(market.asOf).toLocaleString("en-IN")}` : "Delayed market data"}</span></header>
    <section className="market-discovery-controls"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol or company" /></label><div><SlidersHorizontal size={16} /><select value={sector} onChange={(event) => { setSector(event.target.value); setQuickFilter("ALL"); }} aria-label="Filter sector"><option value="ALL">All sectors</option>{sectors.map((item) => <option key={item}>{item}</option>)}</select><select value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="Filter direction"><option value="ALL">All moves</option><option value="GAINERS">Gainers</option><option value="LOSERS">Losers</option></select><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort market"><option value="change">Sort by change</option><option value="volume">Sort by volume</option><option value="price">Sort by price</option><option value="symbol">Sort by symbol</option></select></div></section>
    <Toolbar className="market-quick-filters" aria-label="Quick market filters">{QUICK_FILTERS.map((filter) => <Pill key={filter.id} selected={quickFilter === filter.id} onClick={() => { setQuickFilter(filter.id); setSector("ALL"); }}>{filter.label}</Pill>)}<span className="market-quick-filters__summary">{quickFilter === "NIFTY" ? "NIFTY 50 is the tracked universe" : `${filteredQuotes.length} companies match`}</span></Toolbar>

    {market.error ? <div className="market-inline-error">{market.error}</div> : <>{market.loading ? <div className="market-loading">Loading market snapshot</div> : <section className="mover-grid"><MoverPanel title="Top gainers" rows={gainers} stocks={market.stocks} /><MoverPanel title="Top losers" rows={losers} stocks={market.stocks} /><MoverPanel title="Most active" rows={active} stocks={market.stocks} mode="volume" /></section>}
      <section className="home-section sector-section"><SectionHeader title="Sector performance" action={<span>Area by available market cap, return equally weighted</span>} className="section-heading" /><SectorTreemap tiles={sectorReturns} onSelect={(name) => { setSector(name); setQuickFilter("ALL"); setDirection("ALL"); document.querySelector(".market-discovery-controls")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} /></section>
      <Surface className="market-panel screener-panel"><SectionHeader title="NIFTY 50 screener" action={<span>{rows.length} companies</span>} /><div className="market-screener-wrap"><DataTable className="market-screener"><thead><tr><th>Symbol</th><th>Company</th><th>Sector</th><th>Price</th><th>Change</th><th>Volume</th><th>Trend</th><th>Session</th></tr></thead><tbody>{rows.map((quote) => {
        const stock = metadata.get(quote.symbol);
        const positive = quote.change_pct >= 0;
        const seed = quote.price - quote.change;
        return <tr key={quote.symbol} tabIndex={0} onClick={() => navigate(`/stocks/${quote.symbol.replace(/\.NS$/, "")}`)} onKeyDown={(event) => { if (event.key === "Enter") navigate(`/stocks/${quote.symbol.replace(/\.NS$/, "")}`); }}><td><span className="market-screener__symbol"><CompanyLogo symbol={quote.symbol} size="small" /><strong>{quote.symbol.replace(/\.NS$/, "")}</strong></span></td><td>{stock?.display_name ?? quote.display_name}</td><td>{stock?.sector ?? "--"}</td><td>₹{quote.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td><td className={positive ? "is-positive" : "is-negative"}>{positive ? "+" : ""}{quote.change_pct.toFixed(2)}%</td><td>{(quote.volume / 1e5).toFixed(2)}L</td><td><Sparkline values={[seed, seed + quote.change * .25, seed - quote.change * .1, seed + quote.change * .6, quote.price]} positive={positive} /></td><td><span className={`market-state-chip ${positive ? "is-positive" : "is-negative"}`}>{positive ? "Advancing" : "Declining"}</span></td></tr>;
      })}</tbody></DataTable>{market.loading && <div className="market-loading">Loading NIFTY 50 snapshot</div>}</div></Surface></>}
  </main>;
}
