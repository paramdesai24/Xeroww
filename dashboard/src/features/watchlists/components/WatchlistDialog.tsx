import { useRef, useState } from "react";
import { FieldError } from "../../../components/ui";
import { useDialogFocus } from "../hooks/useDialogFocus";

export type WatchlistDialogMode = "create" | "rename" | "delete" | "remove";

export function WatchlistDialog({ mode, initialName, target, busy, onClose, onConfirm }: {
  mode: WatchlistDialogMode;
  initialName: string;
  target: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (name?: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  useDialogFocus(root, onClose);
  const editing = mode === "create" || mode === "rename";
  const title = mode === "create" ? "Create Watchlist" : mode === "rename" ? "Rename Watchlist" : mode === "delete" ? "Delete Watchlist" : "Remove Symbol";

  const submit = async () => {
    if (editing && !name.trim()) { setError("Enter a watchlist name."); return; }
    if (await onConfirm(editing ? name.trim() : undefined)) onClose();
  };

  return <div className="workspace-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section ref={root} className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="watchlist-dialog-title">
      <p className="decision-eyebrow">Watchlist management</p>
      <h2 id="watchlist-dialog-title" className="type-section-title">{title}</h2>
      {editing ? <label>Name<input maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setError(null); }} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></label> : <p className="type-body">{mode === "delete" ? `Delete ${target}? All tracked symbols in this list will be removed.` : `Remove ${target} from this watchlist?`}</p>}
      <FieldError message={error ?? undefined} />
      <div><button className="workspace-button" onClick={onClose}>Cancel</button><button className={editing ? "decision-primary-action" : "workspace-button workspace-button--danger"} disabled={busy} onClick={() => void submit()}>{busy ? "Saving" : editing ? "Save" : "Confirm"}</button></div>
    </section>
  </div>;
}
