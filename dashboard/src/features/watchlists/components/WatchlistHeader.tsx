import type { Watchlist } from "../../../types/platform";
import { formatFreshness } from "../formatters";

export function WatchlistHeader({ lists, active, asOf, refreshing, onSelect, onAdd, onCreate, onRename, onDelete }: {
  lists: Watchlist[];
  active: Watchlist | null;
  asOf: string | null;
  refreshing: boolean;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return <header className="workspace-header watchlist-header">
    <div>
      <p className="decision-eyebrow">Market monitoring</p>
      <h1 className="type-page-title">Watchlists</h1>
      <p className="type-body">{active ? `${active.item_count ?? 0} symbols · ${refreshing ? "Refreshing quotes" : formatFreshness(asOf)}` : "Track the companies that matter to you."}</p>
    </div>
    <div className="workspace-header__controls">
      {lists.length > 0 && <select aria-label="Active watchlist" value={active?.id ?? ""} onChange={(event) => onSelect(Number(event.target.value))}>
        {lists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}
      </select>}
      <button className="workspace-button" onClick={onCreate}>New</button>
      {active && <button className="workspace-button" onClick={onRename}>Rename</button>}
      {active && !active.is_default && <button className="workspace-button workspace-button--danger" onClick={onDelete}>Delete</button>}
      <button className="decision-primary-action" disabled={!active} onClick={onAdd}>Add Symbol</button>
    </div>
  </header>;
}
