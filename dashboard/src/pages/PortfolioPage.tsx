import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, ErrorNotice, SuccessNotice } from "../components/ui";
import { PortfolioHeader } from "../features/portfolio/components/PortfolioHeader";
import { PortfolioMetrics } from "../features/portfolio/components/PortfolioMetrics";
import { HoldingsTable } from "../features/portfolio/components/HoldingsTable";
import { TradeDrawer } from "../features/portfolio/components/TradeDrawer";
import { usePortfolioWorkspace } from "../features/portfolio/hooks/usePortfolioWorkspace";
import { formatMoney, formatPercent, formatQuantity, formatTimestamp } from "../features/portfolio/formatters";

type Tab = "holdings" | "activity" | "contribution";

function NameDialog({ mode, initialValue, busy, onClose, onSave }: { mode: "create" | "rename"; initialValue: string; busy: boolean; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const normalized = name.trim();
    if (!normalized) return setError("Enter a portfolio name.");
    try { await onSave(normalized); onClose(); } catch { setError("The portfolio name could not be saved."); }
  };
  return <div className="workspace-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-name-title"><p className="decision-eyebrow">Portfolio management</p><h2 id="portfolio-name-title">{mode === "create" ? "Create Portfolio" : "Rename Portfolio"}</h2><label>Name<input autoFocus maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setError(null); }} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></label>{error && <span className="feedback-field-error">{error}</span>}<div><button className="workspace-button" onClick={onClose}>Cancel</button><button className="decision-primary-action" disabled={busy} onClick={() => void submit()}>{busy ? "Saving" : "Save"}</button></div></section></div>;
}

export default function PortfolioPage() {
  const navigate = useNavigate();
  const workspace = usePortfolioWorkspace();
  const loadContribution = workspace.loadContribution;
  const [tab, setTab] = useState<Tab>("holdings");
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState<string | undefined>();
  const [nameDialog, setNameDialog] = useState<"create" | "rename" | null>(null);

  useEffect(() => { if (tab === "contribution") void loadContribution(); }, [tab, loadContribution]);
  const openTrade = (symbol?: string) => { setTradeSymbol(symbol); setTradeOpen(true); };

  if (workspace.loading) return <main className="workspace-page"><div className="workspace-loading"><span>Loading portfolio workspace</span><div /><div /><div /></div></main>;

  return <main className="workspace-page">
    <PortfolioHeader portfolios={workspace.portfolios} activeId={workspace.active?.id} refreshing={workspace.refreshing} onSelect={(id) => void workspace.select(id)} onCreate={() => setNameDialog("create")} onRename={() => setNameDialog("rename")} onTrade={() => openTrade()} onIntelligence={() => workspace.active && navigate(`/portfolio/${workspace.active.id}/overview`)} />
    {workspace.error && <ErrorNotice error={workspace.error} onRetry={() => void workspace.refresh()} onDismiss={workspace.clearError} />}
    {workspace.success && <SuccessNotice message={workspace.success} onDismiss={workspace.clearSuccess} />}

    {!workspace.active ? <EmptyState title="Create your first portfolio" message="Start a paper portfolio to track holdings, activity, and risk context." action={<button className="decision-primary-action" onClick={() => setNameDialog("create")}>Create Portfolio</button>} /> : <>
      <PortfolioMetrics portfolio={workspace.active} />
      <nav className="workspace-tabs" aria-label="Portfolio views">{([['holdings', 'Holdings'], ['activity', 'Activity'], ['contribution', "Today's Contribution"]] as Array<[Tab, string]>).map(([key, label]) => <button key={key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}<button className="workspace-refresh" disabled={workspace.refreshing} onClick={() => void workspace.refresh()}>{workspace.refreshing ? "Refreshing" : "Refresh"}</button></nav>

      {tab === "holdings" && (workspace.active.holdings.length ? <HoldingsTable holdings={workspace.active.holdings} onMarket={(symbol) => navigate(`/market/${encodeURIComponent(symbol)}`)} onDecision={(symbol) => navigate(`/decisions/new?symbol=${encodeURIComponent(symbol)}&source=portfolio&portfolioId=${workspace.active?.id}`)} onSell={(symbol) => openTrade(symbol)} /> : <EmptyState title="No holdings yet" message="Record a paper trade or plan the decision before adding a position." action={<button className="decision-primary-action" onClick={() => openTrade()}>Record Trade</button>} />)}

      {tab === "activity" && <section className="workspace-panel"><div className="workspace-panel__header"><div><h2>Activity</h2><span>Immutable simulated transactions</span></div></div>{workspace.transactions.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th>Quantity</th><th>Execution</th><th>Realized P&amp;L</th></tr></thead><tbody>{workspace.transactions.map((item) => <tr key={item.id}><td>{formatTimestamp(item.timestamp)}</td><td><button className="workspace-symbol" onClick={() => navigate(`/market/${encodeURIComponent(item.symbol)}`)}>{item.symbol}</button></td><td className={item.side === "BUY" ? "is-positive" : "is-negative"}>{item.side}</td><td>{formatQuantity(item.quantity)}</td><td>{formatMoney(item.execution_price)}</td><td className={(item.realized_pnl ?? 0) >= 0 ? "is-positive" : "is-negative"}>{item.realized_pnl == null ? "Not applicable" : formatMoney(item.realized_pnl)}</td></tr>)}</tbody></table></div> : <EmptyState title="No activity yet" message="Completed paper trades will appear here." />}</section>}

      {tab === "contribution" && <section className="workspace-panel"><div className="workspace-panel__header"><div><h2>Today's Contribution</h2><span>Observed move by holding</span></div></div>{workspace.contribution ? <><div className="contribution-summary"><article><span>Day P&amp;L</span><strong className={workspace.contribution.day_pnl_inr >= 0 ? "is-positive" : "is-negative"}>{formatMoney(workspace.contribution.day_pnl_inr)} · {formatPercent(workspace.contribution.day_pnl_pct)}</strong></article><article><span>Largest contributor</span><strong>{workspace.contribution.largest_contributor?.symbol ?? "None"}</strong></article><article><span>Largest detractor</span><strong>{workspace.contribution.largest_detractor?.symbol ?? "None"}</strong></article></div>{workspace.contribution.holdings.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Symbol</th><th>Price</th><th>Day move</th><th>Value</th><th>Contribution</th><th>Allocation</th></tr></thead><tbody>{workspace.contribution.holdings.map((item) => <tr key={item.symbol}><td>{item.symbol}</td><td>{formatMoney(item.current_price)}</td><td className={item.price_change >= 0 ? "is-positive" : "is-negative"}>{formatMoney(item.price_change)}<small>{formatPercent(item.price_change_pct)}</small></td><td>{formatMoney(item.current_value)}</td><td className={item.pnl_contribution_inr >= 0 ? "is-positive" : "is-negative"}>{formatMoney(item.pnl_contribution_inr)}</td><td>{formatPercent(item.allocation_pct)}</td></tr>)}</tbody></table></div> : <EmptyState title="No contribution data" message="Contribution appears when valued holdings are available." />}</> : <div className="workspace-loading workspace-loading--inline"><span>Loading contribution</span><div /><div /></div>}</section>}
    </>}

    {workspace.active && tradeOpen && <TradeDrawer open portfolio={workspace.active} initialSymbol={tradeSymbol} busy={workspace.mutation === "trade"} apiError={workspace.error} onClose={() => { setTradeOpen(false); setTradeSymbol(undefined); }} onPlan={(symbol) => navigate(`/decisions/new?symbol=${encodeURIComponent(symbol)}&source=portfolio&portfolioId=${workspace.active?.id}`)} onSubmit={workspace.trade} />}
    {nameDialog && <NameDialog mode={nameDialog} initialValue={nameDialog === "rename" ? workspace.active?.name ?? "" : ""} busy={workspace.mutation === nameDialog} onClose={() => setNameDialog(null)} onSave={nameDialog === "create" ? workspace.create : workspace.rename} />}
  </main>;
}
