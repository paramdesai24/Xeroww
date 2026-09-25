import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, ErrorNotice, SuccessNotice } from "../components/ui";
import { WatchlistHeader } from "../features/watchlists/components/WatchlistHeader";
import { WatchlistMetrics } from "../features/watchlists/components/WatchlistMetrics";
import { WatchlistTable } from "../features/watchlists/components/WatchlistTable";
import { SymbolPickerDrawer } from "../features/watchlists/components/SymbolPickerDrawer";
import { useWatchlistWorkspace } from "../features/watchlists/hooks/useWatchlistWorkspace";

type Sort = "added" | "symbol" | "move" | "price";
type Dialog = "create" | "rename" | "delete" | "remove" | null;

export default function WatchlistsPage() {
  const navigate = useNavigate();
  const workspace = useWatchlistWorkspace();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("added");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [targetSymbol, setTargetSymbol] = useState("");
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (workspace.snapshot?.rows ?? []).filter((row) => `${row.symbol} ${row.company_name}`.toLowerCase().includes(needle));
    if (sort === "symbol") filtered.sort((left, right) => left.symbol.localeCompare(right.symbol));
    if (sort === "move") filtered.sort((left, right) => (right.change_pct ?? -Infinity) - (left.change_pct ?? -Infinity));
    if (sort === "price") filtered.sort((left, right) => (right.price ?? -Infinity) - (left.price ?? -Infinity));
    return filtered;
  }, [search, sort, workspace.snapshot]);

  const submitDialog = async () => {
    if (dialog === "create" && name.trim()) { if (await workspace.create(name.trim())) setDialog(null); }
    if (dialog === "rename" && name.trim()) { if (await workspace.rename(name.trim())) setDialog(null); }
    if (dialog === "delete") { if (await workspace.removeList()) setDialog(null); }
    if (dialog === "remove") { if (await workspace.removeSymbol(targetSymbol)) setDialog(null); }
  };

  if (workspace.loading && !workspace.snapshot) return <main className="workspace-page"><div className="workspace-loading"><span>Loading watchlists</span><div /><div /><div /></div></main>;

  return <main className="workspace-page watchlist-page">
    <WatchlistHeader lists={workspace.watchlists} active={workspace.active} asOf={workspace.snapshot?.as_of ?? null} refreshing={workspace.refreshing} onSelect={(id) => { setSearch(""); workspace.select(id); }} onAdd={() => setPickerOpen(true)} onCreate={() => { setName(""); setDialog("create"); }} onRename={() => { setName(workspace.active?.name ?? ""); setDialog("rename"); }} onDelete={() => setDialog("delete")} />
    {workspace.error && <ErrorNotice error={workspace.error} onRetry={() => void workspace.refresh()} onDismiss={workspace.clearError} />}
    {workspace.success && <SuccessNotice message={workspace.success} onDismiss={workspace.clearSuccess} />}
    {!workspace.active ? <EmptyState title="Create a watchlist" message="Group companies to monitor their observed market moves." action={<button className="decision-primary-action" onClick={() => { setName(""); setDialog("create"); }}>Create Watchlist</button>} /> : <>
      <WatchlistMetrics rows={workspace.snapshot?.rows ?? []} />
      <div className="watchlist-controls"><label className="type-label">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticker or company" /></label><label className="type-label">Sort<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="added">Addition order</option><option value="symbol">Symbol</option><option value="move">Day move</option><option value="price">Price</option></select></label><button className="workspace-button" disabled={workspace.refreshing} onClick={() => void workspace.refresh()}>{workspace.refreshing ? "Refreshing" : "Refresh"}</button></div>
      <section className="workspace-panel watchlist-results"><div className="workspace-panel__header"><div><h2 className="type-section-title">Observed market state</h2><span className="type-meta">{workspace.snapshot?.data_note ?? "Quotes may be delayed."}</span></div><span className="type-meta">{rows.length} shown</span></div>
        {!workspace.snapshot ? <div className="workspace-loading workspace-loading--inline"><span>Loading market snapshot</span><div /><div /></div> : !workspace.snapshot.rows.length ? <EmptyState title="No symbols tracked" message="Add a company to start monitoring this watchlist." action={<button className="decision-primary-action" onClick={() => setPickerOpen(true)}>Add Symbol</button>} /> : !rows.length ? <EmptyState title="No matches" message="Try a different company or ticker search." /> : <WatchlistTable rows={rows} onMarket={(symbol) => navigate(`/market/${encodeURIComponent(symbol)}`)} onDecision={(symbol) => navigate(`/decisions/new?symbol=${encodeURIComponent(symbol)}&source=WATCHLIST`)} onAlert={(symbol) => navigate(`/alerts?symbol=${encodeURIComponent(symbol)}`)} onRemove={(symbol) => { setTargetSymbol(symbol); setDialog("remove"); }} />}
      </section>
    </>}
    {pickerOpen && <SymbolPickerDrawer existing={workspace.snapshot?.rows.map((row) => row.symbol) ?? []} busy={workspace.mutation === "add"} onClose={() => setPickerOpen(false)} onAdd={workspace.addSymbol} />}
    {dialog && <div className="workspace-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setDialog(null); }}><section className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="watchlist-dialog-title"><p className="decision-eyebrow">Watchlist management</p><h2 id="watchlist-dialog-title" className="type-section-title">{dialog === "create" ? "Create Watchlist" : dialog === "rename" ? "Rename Watchlist" : dialog === "delete" ? "Delete Watchlist" : "Remove Symbol"}</h2>{dialog === "create" || dialog === "rename" ? <label>Name<input autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitDialog(); }} /></label> : <p className="type-body">{dialog === "delete" ? `Delete ${workspace.active?.name}? All tracked symbols in this list will be removed.` : `Remove ${targetSymbol} from this watchlist?`}</p>}<div><button className="workspace-button" onClick={() => setDialog(null)}>Cancel</button><button className={dialog === "delete" || dialog === "remove" ? "workspace-button workspace-button--danger" : "decision-primary-action"} disabled={!!workspace.mutation || ((dialog === "create" || dialog === "rename") && !name.trim())} onClick={() => void submitDialog()}>{workspace.mutation ? "Saving" : dialog === "delete" || dialog === "remove" ? "Confirm" : "Save"}</button></div></section></div>}
  </main>;
}
