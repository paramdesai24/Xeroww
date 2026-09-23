import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api/client";
import MiniSeriesChart from "../components/MiniSeriesChart";
import type { PortfolioAnalytics, PortfolioSnapshot } from "../types/portfolioIntelligence";
import { PageErrorState } from "../components/ui";
import { parsePositiveIntParam } from "../lib/routeParams";

type View = "overview" | "performance" | "attribution" | "risk";
type Metric = { result?: unknown; data_quality?: string; limitations?: string[]; unit?: string };
const metric = (data: PortfolioAnalytics | null, key: string): Metric => (data?.metrics[key] || {}) as Metric;
const pct = (value: unknown) => typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "Unavailable";
const money = (value: number) => `INR ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function PortfolioIntelligencePage() {
  const id = parsePositiveIntParam(useParams().portfolioId);
  const path = useLocation().pathname;
  const view = (path.split("/").at(-1) || "overview") as View;
  const activeView: View = ["performance", "attribution", "risk"].includes(view) ? view : "overview";
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [performance, setPerformance] = useState<PortfolioAnalytics | null>(null);
  const [attribution, setAttribution] = useState<PortfolioAnalytics | null>(null);
  const [risk, setRisk] = useState<PortfolioAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (id === null) return; try { const snap = await api.portfolioIntelligence.capture(id); setSnapshot(snap); const [p, a, r] = await Promise.all([api.portfolioIntelligence.performance(id), api.portfolioIntelligence.attribution(id), api.portfolioIntelligence.risk(id)]); setPerformance(p); setAttribution(a); setRisk(r); } catch (reason) { setError(reason instanceof Error ? reason.message : "Portfolio intelligence failed"); } }, [id]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const values = (performance?.series.portfolio_values || []) as number[];
  const benchmark = (performance?.series.benchmark_values || []) as Array<number | null>;
  const holdings = useMemo(() => snapshot?.holdings.slice().sort((a, b) => b.market_value - a.market_value) || [], [snapshot]);
  const attributionMetrics = attribution?.metrics as Record<string, unknown> | undefined;
  const riskMetrics = risk?.metrics as Record<string, unknown> | undefined;
  if (id === null) return <PageErrorState title="Invalid portfolio" message="This portfolio intelligence link is invalid." actionHref="/portfolio" actionLabel="Back to Portfolio" />;
  return <main className="decision-page intelligence-page">
    <header className="decision-page__header"><div><p className="decision-eyebrow">Portfolio intelligence</p><h1>Portfolio {id}</h1><p>Observed performance, attribution, concentration, and advisory risk checks.</p></div><Link className="decision-secondary-action" to="/portfolio">Back to Portfolio</Link></header>
    {error && <div className="decision-error">{error}</div>}
    <nav className="intelligence-tabs">{(["overview", "performance", "attribution", "risk"] as View[]).map((tab) => <Link className={activeView === tab ? "is-active" : ""} key={tab} to={`/portfolio/${id}/${tab}`}>{tab}</Link>)}</nav>
    {!snapshot ? <div className="decision-empty">Building a reproducible valuation snapshot...</div> : <>
      <section className="intelligence-kpis"><article><span>Total value</span><strong>{money(snapshot.total_value)}</strong></article><article><span>Cash</span><strong>{money(snapshot.cash)}</strong></article><article><span>Unrealized P&amp;L</span><strong>{money(snapshot.unrealized_pnl)}</strong></article><article><span>Absolute return</span><strong>{pct(metric(performance, "absolute_return").result)}</strong></article><article><span>Maximum drawdown</span><strong>{pct(metric(performance, "maximum_drawdown").result)}</strong></article></section>
      {(activeView === "overview" || activeView === "performance") && <section className="intelligence-workspace"><div className="intelligence-main"><MiniSeriesChart values={values} benchmark={benchmark} label="Portfolio value and NIFTY 50 benchmark" /><div className="intelligence-card-grid"><article><span>Time weighted return</span><strong>{pct(metric(performance, "time_weighted_return").result)}</strong></article><article><span>Excess return</span><strong>{pct(metric(performance, "excess_return").result)}</strong></article><article><span>Annualized volatility</span><strong>{pct(metric(performance, "annualized_volatility").result)}</strong></article><article><span>Cash drag</span><strong>{pct(metric(performance, "cash_drag").result)}</strong></article></div></div><aside className="intelligence-aside"><div><h2>Valuation quality</h2><strong>{String(snapshot.data_quality.state || "UNKNOWN")}</strong><p>{snapshot.holdings.length} holdings · snapshot {snapshot.snapshot_sequence}</p><p>Benchmark: {snapshot.benchmark_symbol}</p></div><details><summary>Formula notes</summary>{Object.entries(performance?.metrics || {}).map(([key, raw]) => <p key={key}><strong>{key.replaceAll("_", " ")}</strong><br />{((raw as Metric).limitations || []).join(" ") || "Calculated from observed snapshots."}</p>)}</details></aside></section>}
      {activeView === "attribution" && <section className="intelligence-workspace"><div className="intelligence-main"><h2>Holding contribution</h2><div className="intelligence-table">{holdings.map((holding) => <div key={holding.symbol}><strong>{holding.symbol}</strong><span>{money(holding.market_value)}</span><span>{(holding.portfolio_weight * 100).toFixed(1)}%</span><span>{money(holding.unrealized_pnl)}</span></div>)}</div></div><aside className="intelligence-aside"><div><h2>Observed attribution</h2><pre>{JSON.stringify(attributionMetrics, null, 2)}</pre></div></aside></section>}
      {activeView === "risk" && <section className="intelligence-workspace"><div className="intelligence-main"><h2>Advisory warnings</h2>{risk?.warnings.length ? risk.warnings.slice(0, 3).map((warning, index) => <article className="intelligence-warning" key={index}><strong>{String(warning.code || "RISK_WARNING").replaceAll("_", " ")}</strong><span>{String(warning.subject || "Portfolio")}: {String(warning.actual ?? "")}</span></article>) : <div className="decision-empty">No configured risk threshold is currently breached.</div>}<details><summary>Correlation and covariance detail</summary><pre>{JSON.stringify(riskMetrics, null, 2)}</pre></details></div><aside className="intelligence-aside"><div><h2>Concentration</h2><p>Risk is advisory and never blocks a decision. It surfaces policy thresholds with the observed value.</p></div><Link className="decision-secondary-action" to={`/decisions/new?source=PORTFOLIO&portfolioId=${id}`}>Plan a Decision</Link></aside></section>}
    </>}
  </main>;
}
