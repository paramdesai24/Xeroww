import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { DecisionDetail, EvidenceItem } from "../types/decision";

const value = (input: unknown) => input === null || input === undefined ? "Not set" : String(input);

export default function DecisionDetailPage() {
  const { decisionId } = useParams();
  const id = Number(decisionId);
  const [decision, setDecision] = useState<DecisionDetail | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setDecision(await api.decisions.get(id)); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load decision"); }
  }, [id]);
  useEffect(() => { if (Number.isFinite(id)) queueMicrotask(() => void load()); }, [id, load]);

  const addObservation = async () => {
    if (!decision || reason.trim().length < 5) return;
    try { setDecision(await api.decisions.addAmendment(id, "OBSERVATION", reason.trim(), {}, decision.version)); setReason(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to add observation"); }
  };
  const transition = async (next: "CLOSED" | "CANCELLED") => {
    if (!decision || reason.trim().length < 5) return;
    try { setDecision(await api.decisions.transitionStatus(id, next, reason.trim(), decision.version)); setReason(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Status update failed"); }
  };

  if (error && !decision) return <main className="decision-page"><div className="decision-error">{error}</div></main>;
  if (!decision) return <main className="decision-page"><div className="decision-empty">Loading decision...</div></main>;

  const snapshot = decision.context_snapshot;
  const evidence = snapshot?.evidence;
  return (
    <main className="decision-page">
      <header className="decision-page__header">
        <div><p className="decision-eyebrow">Immutable decision #{decision.id}</p><h1>{decision.symbol}</h1><p>{decision.direction ?? "LEGACY"} / {decision.intent} / {decision.holding_period ?? "Unspecified horizon"}</p></div>
        <div className="decision-header-actions"><Link className="decision-secondary-action" to={`/stocks/${encodeURIComponent(decision.symbol.replace(/\.NS$/, ""))}`}>Open Stock</Link><span className={`decision-status decision-status--${decision.status.toLowerCase()}`}>{decision.status}</span></div>
      </header>
      {error && <div className="decision-error">{error}</div>}
      {decision.ticket_version === 0 && <div className="decision-warning">This earlier journal entry may have an incomplete analytical snapshot.</div>}

      <div className="decision-detail-grid">
        <section className="decision-panel">
          <h2>Original plan</h2>
          <dl className="decision-definition-list">
            <div><dt>Setup</dt><dd>{value(decision.setup_type)}</dd></div>
            <div><dt>Entry zone</dt><dd>{value(decision.entry_zone_low)} to {value(decision.entry_zone_high)}</dd></div>
            <div><dt>Invalidation</dt><dd>{value(decision.invalidation_price)}</dd></div>
            <div><dt>Target zone</dt><dd>{value(decision.target_zone_low)} to {value(decision.target_zone_high)}</dd></div>
            <div><dt>Confidence</dt><dd>{value(decision.confidence)} / 5</dd></div>
          </dl>
          <h3>Thesis</h3><p>{decision.thesis}</p>
          <h3>Entry trigger</h3><p>{value(decision.entry_trigger)}</p>
          <h3>What would change my mind?</h3><p>{value(decision.change_mind_condition)}</p>
        </section>

        <section className="decision-panel">
          <h2>Risk at submission</h2>
          <dl className="decision-definition-list">
            <div><dt>Quantity</dt><dd>{value(decision.risk_snapshot.recommended_quantity)}</dd></div>
            <div><dt>Capital deployed</dt><dd>{value(decision.risk_snapshot.capital_deployed)}</dd></div>
            <div><dt>Potential loss</dt><dd>{value(decision.risk_snapshot.potential_loss)}</dd></div>
            <div><dt>Reward-to-risk</dt><dd>{value(decision.risk_snapshot.reward_to_risk)}R</dd></div>
          </dl>
          <h2>Provenance</h2>
          <p>{value(snapshot?.metadata?.provider)} / {value(snapshot?.metadata?.resolved_as_of)}</p>
          <p>{value(snapshot?.metadata?.bar_count)} candles, schema V{value(snapshot?.metadata?.schema_version)}</p>
          <code className="decision-hash">{decision.snapshot_hash ?? "Legacy snapshot has no hash"}</code>
        </section>
      </div>

      {evidence && <section className="decision-panel"><h2>Evidence: {value(evidence.summary).replaceAll("_", " ")}</h2><div className="decision-evidence-grid">{evidence.items.map((item: EvidenceItem) => <article className={`evidence-item evidence-item--${item.relationship}`} key={item.key}><div><strong>{item.label.replaceAll("_", " ")}</strong><span>{item.relationship}</span></div><p>{item.explanation}</p></article>)}</div><p className="decision-note">{evidence.methodology_note}</p></section>}

      <section className="decision-panel">
        <h2>Decision timeline</h2>
        {decision.amendments.length === 0 ? <p className="decision-note">No amendments. The original decision remains unchanged.</p> : decision.amendments.map((item) => <article className="decision-amendment" key={item.id}><strong>{item.amendment_type.replaceAll("_", " ")}</strong><span>{new Date(item.created_at).toLocaleString("en-IN")}</span><p>{item.reason}</p></article>)}
        {decision.status === "OPEN" && <div className="decision-lifecycle"><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required reason for an observation, close, or cancel action" /><div><button onClick={() => void addObservation()}>Add Observation</button><button onClick={() => void transition("CLOSED")}>Close Decision</button><button className="danger" onClick={() => void transition("CANCELLED")}>Cancel Decision</button></div></div>}
      </section>
    </main>
  );
}
