import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DecisionSummary } from "../types/decision";

export default function DecisionsPage() {
  const [items, setItems] = useState<DecisionSummary[]>([]);
  const [status, setStatus] = useState("");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (symbol.trim()) params.set("symbol", symbol.trim().toUpperCase());
      const result = await api.decisions.list(params.toString());
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, [status, symbol]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const counts = items.reduce((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1;
    return result;
  }, {} as Record<string, number>);

  return (
    <main className="decision-page">
      <header className="decision-page__header">
        <div>
          <p className="decision-eyebrow">Decision workbench</p>
          <h1>Decision Journal</h1>
          <p>Immutable market plans with evidence, risk, and point-in-time provenance.</p>
        </div>
        <Link className="decision-primary-action" to="/decisions/new">New Decision</Link>
      </header>

      <section className="decision-metrics">
        {["OPEN", "CLOSED", "CANCELLED"].map((key) => (
          <div className="decision-metric" key={key}><span>{key}</span><strong>{counts[key] ?? 0}</strong></div>
        ))}
      </section>

      <section className="decision-filter-bar">
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Filter symbol" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button onClick={() => void load()}>Refresh</button>
      </section>

      {error && <div className="decision-error">{error}</div>}
      {loading ? <div className="decision-empty">Loading decisions...</div> : items.length === 0 ? (
        <div className="decision-empty">No decisions match this view. Start from Market or create one here.</div>
      ) : (
        <section className="decision-list">
          {items.map((item) => (
            <Link className="decision-list__row" to={`/decisions/${item.id}`} key={item.id}>
              <div><strong>{item.symbol}</strong><span>{item.direction ?? "LEGACY"} / {item.intent ?? "JOURNAL"}</span></div>
              <div><span>Evidence</span><strong>{item.evidence_summary ?? "Legacy snapshot"}</strong></div>
              <div><span>Aligned / Conflict</span><strong>{item.evidence_counts.aligned ?? 0} / {item.evidence_counts.conflicting ?? 0}</strong></div>
              <div><span>As of</span><strong>{new Date(item.source_as_of ?? item.timestamp).toLocaleDateString("en-IN")}</strong></div>
              <div className={`decision-status decision-status--${item.status.toLowerCase()}`}>{item.status}</div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
