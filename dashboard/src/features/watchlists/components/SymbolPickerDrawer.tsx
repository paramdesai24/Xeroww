import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../api/client";
import type { StockMeta } from "../../../types/market";
import { searchSymbols } from "../../../utils/symbolSearch";
import { FieldError } from "../../../components/ui";
import { useDialogFocus } from "../hooks/useDialogFocus";

export function SymbolPickerDrawer({ existing, busy, onClose, onAdd }: {
  existing: string[];
  busy: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => Promise<boolean>;
}) {
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StockMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);
  const matches = useMemo(() => searchSymbols(stocks, query), [stocks, query]);
  const known = selected && existing.includes(selected.symbol);

  useEffect(() => { api.getStocks().then(setStocks).catch(() => setError("Company list is unavailable. Try again.")); }, []);

  const submit = async () => {
    if (!selected || known) { setError(known ? "This symbol is already tracked." : "Select a company first."); return; }
    if (await onAdd(selected.symbol)) onClose();
  };

  return <div className="workspace-drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <aside ref={dialogRef} className="workspace-drawer" role="dialog" aria-modal="true" aria-labelledby="watchlist-picker-title">
      <header><div><p className="decision-eyebrow">NIFTY 50 catalogue</p><h2 id="watchlist-picker-title" className="type-section-title">Add Symbol</h2></div><button onClick={onClose} aria-label="Close symbol picker">Close</button></header>
      <div className="workspace-drawer__body">
        <label>Company or ticker<input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); setError(null); }} placeholder="Search a company" /></label>
        {query.trim() && <div className="watchlist-picker-results" role="listbox" aria-label="Company matches">{matches.length ? matches.map((stock) => <button role="option" aria-selected={selected?.symbol === stock.symbol} className={selected?.symbol === stock.symbol ? "is-selected" : ""} key={stock.symbol} onClick={() => { setSelected(stock); setQuery(stock.display_name); setError(null); }}><strong>{stock.display_name}</strong><span>{stock.symbol}</span></button>) : <p className="type-meta">No supported companies match.</p>}</div>}
        {selected && <div className="trade-preview"><span>{selected.display_name} · NSE</span><strong>{selected.symbol}</strong></div>}
        <p className="workspace-note">Quotes may be delayed. This list tracks symbols only.</p>
        {known && <FieldError message="This symbol is already tracked." />}
        <FieldError message={error ?? undefined} />
        <div className="workspace-drawer__actions"><button className="workspace-button" onClick={onClose}>Cancel</button><button className="decision-primary-action" disabled={!selected || !!known || busy} onClick={() => void submit()}>{busy ? "Adding" : "Add Symbol"}</button></div>
      </div>
    </aside>
  </div>;
}
