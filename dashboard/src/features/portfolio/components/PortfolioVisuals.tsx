import { useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import MiniSeriesChart from "../../../components/MiniSeriesChart";
import { SectionHeader, Surface } from "../../../components/ui";
import type { PortfolioSummary } from "../../../types/platform";
import type { PortfolioContributionResponse } from "../../../types/structure";
import type { StockMeta } from "../../../types/market";

export function PortfolioVisuals({ portfolio, contribution }: { portfolio: PortfolioSummary; contribution: PortfolioContributionResponse | null }) {
  const [equity, setEquity] = useState<number[]>([]);
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api.portfolioIntelligence.snapshots(portfolio.id), api.getStocks()]).then(([snapshots, catalog]) => {
      if (!active) return;
      if (snapshots.status === "fulfilled") setEquity(snapshots.value.items.slice().reverse().map((item) => item.total_value));
      if (catalog.status === "fulfilled") setStocks(catalog.value);
    });
    return () => { active = false; };
  }, [portfolio.id]);
  const allocations = portfolio.holdings.slice().sort((a, b) => (b.allocation_pct ?? 0) - (a.allocation_pct ?? 0));
  const sectors = useMemo(() => {
    const sectorBySymbol = new Map(stocks.map((stock) => [stock.symbol, stock.sector]));
    const grouped = new Map<string, number>();
    portfolio.holdings.forEach((holding) => grouped.set(sectorBySymbol.get(holding.symbol) ?? "Other", (grouped.get(sectorBySymbol.get(holding.symbol) ?? "Other") ?? 0) + (holding.allocation_pct ?? 0)));
    return Array.from(grouped, ([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
  }, [portfolio.holdings, stocks]);
  const donut = allocations.length ? allocations.reduce((parts, holding, index) => {
    const start = allocations.slice(0, index).reduce((sum, item) => sum + (item.allocation_pct ?? 0), 0);
    const end = start + (holding.allocation_pct ?? 0);
    parts.push(`var(--portfolio-${index % 6}) ${start}% ${end}%`);
    return parts;
  }, [] as string[]).join(", ") : "var(--surface-3) 0 100%";

  return <section className="portfolio-visual-grid">
    <Surface className="portfolio-visual portfolio-equity"><SectionHeader title="Equity curve" action={<span>{equity.length > 1 ? `${equity.length} valuation snapshots` : "Current valuation"}</span>} /><MiniSeriesChart values={equity.length ? equity : [portfolio.total_value]} label="Portfolio equity curve" /><div className="portfolio-equity__footer"><span>Current portfolio value</span><strong>₹{portfolio.total_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong></div></Surface>
    <Surface className="portfolio-visual portfolio-allocation"><SectionHeader title="Allocation" action={<span>Current holdings</span>} /><div className="portfolio-allocation__body"><div className="portfolio-donut" style={{ background: `conic-gradient(${donut})` }}><span>{portfolio.holdings.length}<small>holdings</small></span></div><div className="portfolio-legend">{allocations.slice(0, 5).map((holding, index) => <div key={holding.symbol}><i style={{ background: `var(--portfolio-${index % 6})` }} /><span>{holding.symbol.replace(/\.NS$/, "")}</span><strong>{(holding.allocation_pct ?? 0).toFixed(1)}%</strong></div>)}</div></div></Surface>
    <Surface className="portfolio-visual"><SectionHeader title="Sector allocation" action={<span>Current market value</span>} /><div className="portfolio-bars">{sectors.slice(0, 6).map((item) => <div key={item.name}><span>{item.name}</span><div><i style={{ width: `${item.weight}%` }} /></div><strong>{item.weight.toFixed(1)}%</strong></div>)}</div></Surface>
    <Surface className="portfolio-visual"><SectionHeader title="Daily contribution" action={<span>Observed holding impact</span>} /><div className="portfolio-bars portfolio-bars--contribution">{contribution?.holdings.slice().sort((a, b) => Math.abs(b.pnl_contribution_inr) - Math.abs(a.pnl_contribution_inr)).slice(0, 6).map((item) => <div key={item.symbol}><span>{item.symbol.replace(/\.NS$/, "")}</span><div><i className={item.pnl_contribution_inr >= 0 ? "is-positive" : "is-negative"} style={{ width: `${Math.min(100, Math.abs(item.pnl_contribution_inr) / Math.max(1, Math.abs(contribution.day_pnl_inr)) * 100)}%` }} /></div><strong className={item.pnl_contribution_inr >= 0 ? "is-positive" : "is-negative"}>₹{item.pnl_contribution_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong></div>) ?? <p>Contribution appears when holdings are valued.</p>}</div></Surface>
  </section>;
}
