import type { PortfolioSummary } from "../../../types/platform";
import { formatMoney, formatPercent } from "../formatters";

export function PortfolioMetrics({ portfolio }: { portfolio: PortfolioSummary }) {
  const metrics = [
    { label: "Total value", value: formatMoney(portfolio.total_value), note: "Cash plus holdings" },
    { label: "Available cash", value: formatMoney(portfolio.cash_balance), note: "Ready for simulation" },
    { label: "Invested value", value: formatMoney(portfolio.holdings_value), note: `${portfolio.holdings.length} holdings` },
    {
      label: "Unrealized P&L",
      value: `${formatMoney(portfolio.total_unrealized_pnl)} · ${formatPercent(portfolio.total_unrealized_pnl_pct)}`,
      note: "Open positions only",
      tone: portfolio.total_unrealized_pnl >= 0 ? "positive" : "negative",
    },
  ];
  return <section className="workspace-metrics">{metrics.map((item) => <article key={item.label}><span>{item.label}</span><strong className={item.tone ? `is-${item.tone}` : undefined}>{item.value}</strong><small>{item.note}</small></article>)}</section>;
}
