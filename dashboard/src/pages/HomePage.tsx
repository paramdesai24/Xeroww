import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Clock3 } from "lucide-react";
import { api, getStoredToken } from "../api/client";
import GlobalSearch from "../components/GlobalSearch";
import MoverPanel from "../components/market/MoverPanel";
import Sparkline from "../components/market/Sparkline";
import { useMarketUniverse } from "../hooks/useMarketUniverse";
import type { OHLCData, QuoteData } from "../types/market";
import type { WatchlistSnapshot } from "../types/platform";
import { Pill, SectionHeader, Surface } from "../components/ui";
import CompanyLogo from "../components/market/CompanyLogo";

const HERO_SYMBOLS = [
  { label: "NIFTY", symbol: "^NSEI" },
  { label: "SENSEX", symbol: "^BSESN" },
  { label: "BANKNIFTY", symbol: "^NSEBANK" },
];

const INDEX_SYMBOLS = [
  { label: "NIFTY 50", symbol: "^NSEI" },
  { label: "SENSEX", symbol: "^BSESN" },
  { label: "BANK NIFTY", symbol: "^NSEBANK" },
  { label: "INDIA VIX", symbol: "^INDIAVIX" },
];

function formatUpdated(value: string | null): string {
  if (!value) return "Waiting for market data";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(value));
}

export default function HomePage() {
  const navigate = useNavigate();
  const market = useMarketUniverse();
  const [heroSymbol, setHeroSymbol] = useState(HERO_SYMBOLS[0].symbol);
  const [indices, setIndices] = useState<Array<{ meta: typeof INDEX_SYMBOLS[number]; quote: QuoteData | null; ohlc: OHLCData | null }>>([]);
  const [watchlist, setWatchlist] = useState<WatchlistSnapshot | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setHeroSymbol((current) => HERO_SYMBOLS[(HERO_SYMBOLS.findIndex((item) => item.symbol === current) + 1) % HERO_SYMBOLS.length].symbol);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all(INDEX_SYMBOLS.map(async (meta) => {
      const [quote, ohlc] = await Promise.allSettled([api.getQuote(meta.symbol), api.getOHLC(meta.symbol, "1mo", "1d")]);
      return { meta, quote: quote.status === "fulfilled" ? quote.value : null, ohlc: ohlc.status === "fulfilled" ? ohlc.value : null };
    })).then((rows) => { if (active) setIndices(rows); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!getStoredToken()) return;
    api.watchlists.list().then((lists) => lists[0] ? api.watchlists.snapshot(lists[0].id) : null).then((snapshot) => setWatchlist(snapshot)).catch(() => setWatchlist(null));
  }, []);

  const sorted = useMemo(() => ({
    gainers: market.quotes.slice().sort((a, b) => b.change_pct - a.change_pct).slice(0, 5),
    losers: market.quotes.slice().sort((a, b) => a.change_pct - b.change_pct).slice(0, 5),
    active: market.quotes.slice().sort((a, b) => b.volume - a.volume).slice(0, 5),
  }), [market.quotes]);
  const hero = indices.find((item) => item.meta.symbol === heroSymbol)?.ohlc ?? null;
  const heroValues = hero?.candles.map((candle) => candle.close) ?? [];
  const breadthTotal = Math.max(1, (market.breadth?.advancing ?? 0) + (market.breadth?.declining ?? 0) + (market.breadth?.unchanged ?? 0));

  return <main className="market-home">
    <section className="home-hero">
      <div className="home-hero__copy"><p className="decision-eyebrow">India market overview</p><h1>Indian markets, clearly organized.</h1><p>Discover market leadership, inspect price action, and move from evidence to a recorded decision.</p><GlobalSearch onOpenSymbol={(symbol) => navigate(`/stocks/${symbol.replace(/\.NS$/, "")}`)} /><div className="home-market-state"><span><Activity size={14} /> Delayed market data</span><span><Clock3 size={14} /> Updated {formatUpdated(market.asOf)}</span></div></div>
      <Surface className="home-hero-chart" aria-label="Market pulse chart"><header><div><span>Market pulse</span><strong key={heroSymbol} className="home-hero-chart__transition">{HERO_SYMBOLS.find((item) => item.symbol === heroSymbol)?.label}</strong></div><div>{HERO_SYMBOLS.map((item) => <Pill key={item.symbol} selected={heroSymbol === item.symbol} onClick={() => setHeroSymbol(item.symbol)}>{item.label}</Pill>)}</div></header><div key={heroSymbol} className="home-hero-chart__series home-hero-chart__transition"><Sparkline values={heroValues} positive={heroValues.length > 1 && heroValues.at(-1)! >= heroValues[0]} label="One month closing-price trend" /></div><footer><span>1 month daily</span><span>{hero?.data_note ?? "Loading series"}</span></footer></Surface>
    </section>

    <section className="home-section"><SectionHeader title="Market indices" action={<span>Delayed provider data</span>} className="section-heading" /><div className="index-grid">{indices.map(({ meta, quote, ohlc }) => <Surface className="index-card" key={meta.symbol}><header><strong>{meta.label}</strong><span className={(quote?.change_pct ?? 0) >= 0 ? "is-positive" : "is-negative"}>{quote ? `${quote.change_pct >= 0 ? "+" : ""}${quote.change_pct.toFixed(2)}%` : "Unavailable"}</span></header><div className="index-card__body"><strong>{quote ? quote.price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "--"}</strong><Sparkline values={ohlc?.candles.map((candle) => candle.close) ?? []} positive={(quote?.change_pct ?? 0) >= 0} /></div><footer><span>H {quote?.day_high.toLocaleString("en-IN") ?? "--"}</span><span>L {quote?.day_low.toLocaleString("en-IN") ?? "--"}</span></footer></Surface>)}</div></section>

    <section className="home-section"><SectionHeader title="Market movers" action={<Link to="/markets">View all markets</Link>} className="section-heading" />{market.loading ? <div className="market-loading">Loading market leadership</div> : market.error ? <div className="market-inline-error">{market.error}</div> : <div className="mover-grid"><MoverPanel title="Top gainers" rows={sorted.gainers} stocks={market.stocks} /><MoverPanel title="Top losers" rows={sorted.losers} stocks={market.stocks} /><MoverPanel title="Most active" rows={sorted.active} stocks={market.stocks} mode="volume" /></div>}</section>

    <section className="home-lower-grid"><Surface className="market-panel breadth-panel"><SectionHeader title="Market breadth" action={<strong>{market.breadth?.breadth_ratio ?? "--"} ratio</strong>} /><div className="breadth-panel__body"><div className="breadth-highlights"><div><span>Advancing</span><strong className="is-positive">{market.breadth?.advancing ?? "--"}</strong></div><div><span>Declining</span><strong className="is-negative">{market.breadth?.declining ?? "--"}</strong></div></div><div className="breadth-bar" aria-label="Advance decline distribution"><span className="breadth-bar__advance" style={{ width: `${((market.breadth?.advancing ?? 0) / breadthTotal) * 100}%` }} /><span className="breadth-bar__flat" style={{ width: `${((market.breadth?.unchanged ?? 0) / breadthTotal) * 100}%` }} /><span className="breadth-bar__decline" style={{ width: `${((market.breadth?.declining ?? 0) / breadthTotal) * 100}%` }} /></div></div><div className="breadth-metrics"><div><span>Unchanged</span><strong>{market.breadth?.unchanged ?? "--"}</strong></div><div><span>Above +2%</span><strong>{market.breadth?.distribution_buckets.gain_gt_2pct ?? "--"}</strong></div><div><span>Below -2%</span><strong>{market.breadth?.distribution_buckets.loss_gt_2pct ?? "--"}</strong></div></div></Surface>
      <Surface className="market-panel home-watchlist"><SectionHeader title="Watchlist" action={<Link to="/watchlists">Open watchlist</Link>} />{watchlist ? watchlist.rows.slice(0, 5).map((row) => <button key={row.symbol} onClick={() => navigate(`/stocks/${row.symbol.replace(/\.NS$/, "")}`)}><CompanyLogo symbol={row.symbol} /><span><strong>{row.symbol.replace(/\.NS$/, "")}</strong><small>{row.company_name}</small></span><span><strong>{row.price ? `₹${row.price.toLocaleString("en-IN")}` : "--"}</strong><small className={(row.change_pct ?? 0) >= 0 ? "is-positive" : "is-negative"}>{row.change_pct == null ? "--" : `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}%`}</small></span></button>) : <div className="home-watchlist__empty"><p>{getStoredToken() ? "Add companies to build your daily monitor." : "Sign in to see your personal watchlist."}</p><Link to="/watchlists">Open watchlists</Link></div>}</Surface>
    </section>
  </main>;
}
