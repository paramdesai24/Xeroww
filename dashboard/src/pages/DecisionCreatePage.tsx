import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import EvidenceAnalysisOverlay from "../components/EvidenceAnalysisOverlay";
import SymbolAutocomplete from "../components/SymbolAutocomplete";
import { shortEvidenceExplanation } from "../utils/evidencePresentation";
import type { DecisionDirection, DecisionIntent, DecisionPlan, DecisionPreview, DecisionSource } from "../types/decision";

const numeric = (value: string): number | null => value === "" ? null : Number(value);

export default function DecisionCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialSource = (params.get("source")?.toUpperCase() ?? "MANUAL") as DecisionSource;
  const [plan, setPlan] = useState<DecisionPlan>({
    symbol: params.get("symbol") ?? "",
    direction: "BULLISH",
    intent: "WATCH",
    holding_period: "SWING",
    setup_type: "Structure and confluence",
    entry_trigger: "",
    entry_zone_low: null,
    entry_zone_high: null,
    invalidation_price: null,
    target_zone_low: null,
    target_zone_high: null,
    max_risk_pct: 1,
    max_allocation_pct: 20,
    capital_base: 100000,
    confidence: 3,
    thesis: "",
    change_mind_condition: "",
    portfolio_id: params.get("portfolioId") ? Number(params.get("portfolioId")) : null,
    source_context: initialSource,
    source_as_of: params.get("asOf"),
    source_period: params.get("period") ?? "1y",
  });
  const [preview, setPreview] = useState<DecisionPreview | null>(null);
  const [supporting, setSupporting] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [conflictsReviewed, setConflictsReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const storageKey = useMemo(() => `xeroww:decision-draft:${plan.source_context}:${params.toString()}`, [plan.source_context, params]);
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DecisionPlan;
        queueMicrotask(() => setPlan(parsed));
      } catch { sessionStorage.removeItem(storageKey); }
    }
  }, [storageKey]);
  useEffect(() => { sessionStorage.setItem(storageKey, JSON.stringify(plan)); }, [plan, storageKey]);

  const update = <K extends keyof DecisionPlan>(key: K, value: DecisionPlan[K]) => setPlan((current) => ({ ...current, [key]: value }));

  const loadPreview = async () => {
    const symbol = plan.symbol.trim();
    if (!symbol) {
      setError("Enter a symbol before building the evidence preview, for example RELIANCE.NS.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const result = await api.decisions.preview({ ...plan, symbol });
      setPreview(result);
      setSupporting(result.evidence.items.filter((item) => item.relationship === "aligned").map((item) => item.key));
      setConflicts(result.evidence.items.filter((item) => item.relationship === "conflicting").map((item) => item.key));
      setConflictsReviewed(result.evidence.counts.conflicting === 0);
    } catch (err) { setError(err instanceof Error ? err.message : "Preview failed"); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!preview) return;
    setBusy(true); setError(null);
    try {
      const created = await api.decisions.create({
        ...plan,
        expected_as_of: preview.resolved_as_of,
        supporting_evidence_keys: supporting,
        conflicting_evidence_keys: conflicts,
        conflicts_reviewed: conflictsReviewed,
      });
      sessionStorage.removeItem(storageKey);
      navigate(`/decisions/${created.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Decision submission failed"); }
    finally { setBusy(false); }
  };

  const entryPlan = plan.intent === "ENTER" || plan.intent === "ADD";

  return (
    <main className="decision-page decision-create">
      <header className="decision-page__header">
        <div><p className="decision-eyebrow">Structured decision ticket</p><h1>Plan a Decision</h1><p>The submitted plan and its analytical context cannot be rewritten.</p></div>
        <Link className="decision-secondary-action" to="/decisions">Back to Decisions</Link>
      </header>
      {error && <div className="decision-error">{error}</div>}
      <div className="decision-create__grid">
        <section className="decision-form">
          <h2>Context and intent</h2>
          <div className="decision-form__grid">
            <label>Symbol<SymbolAutocomplete value={plan.symbol} onChange={(symbol) => update("symbol", symbol)} /></label>
            <label>Direction<select value={plan.direction} onChange={(e) => update("direction", e.target.value as DecisionDirection)}><option>BULLISH</option><option>BEARISH</option><option>NEUTRAL</option></select></label>
            <label>Intent<select value={plan.intent} onChange={(e) => update("intent", e.target.value as DecisionIntent)}>{["ENTER","ADD","HOLD","REDUCE","EXIT","WATCH","AVOID"].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label>Holding period<select value={plan.holding_period} onChange={(e) => update("holding_period", e.target.value)}><option>INTRADAY</option><option>SWING</option><option>POSITIONAL</option><option>LONG_TERM_RESEARCH</option></select></label>
            <label>Setup classification<input value={plan.setup_type} onChange={(e) => update("setup_type", e.target.value)} /></label>
            <label>User confidence<select value={plan.confidence} onChange={(e) => update("confidence", Number(e.target.value))}>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} / 5</option>)}</select></label>
          </div>

          <h2>Plan and risk</h2>
          <label>Entry trigger<textarea value={plan.entry_trigger ?? ""} onChange={(e) => update("entry_trigger", e.target.value)} placeholder="The observable condition required before entry" /></label>
          <div className="decision-form__grid">
            <label>Entry zone low<input type="number" value={plan.entry_zone_low ?? ""} onChange={(e) => update("entry_zone_low", numeric(e.target.value))} /></label>
            <label>Entry zone high<input type="number" value={plan.entry_zone_high ?? ""} onChange={(e) => update("entry_zone_high", numeric(e.target.value))} /></label>
            <label>Invalidation<input type="number" value={plan.invalidation_price ?? ""} onChange={(e) => update("invalidation_price", numeric(e.target.value))} /></label>
            <label>Target low<input type="number" value={plan.target_zone_low ?? ""} onChange={(e) => update("target_zone_low", numeric(e.target.value))} /></label>
            <label>Target high<input type="number" value={plan.target_zone_high ?? ""} onChange={(e) => update("target_zone_high", numeric(e.target.value))} /></label>
            <label>Capital base<input type="number" value={plan.capital_base ?? ""} onChange={(e) => update("capital_base", numeric(e.target.value))} /></label>
            <label>Maximum risk %<input type="number" step="0.1" value={plan.max_risk_pct ?? ""} onChange={(e) => update("max_risk_pct", numeric(e.target.value))} /></label>
            <label>Maximum allocation %<input type="number" step="1" value={plan.max_allocation_pct ?? ""} onChange={(e) => update("max_allocation_pct", numeric(e.target.value))} /></label>
          </div>
          {!entryPlan && <p className="decision-note">Position sizing is intentionally not applicable to this intent.</p>}

          <h2>Thesis</h2>
          <label>Why this decision?<textarea value={plan.thesis} onChange={(e) => update("thesis", e.target.value)} placeholder="State the evidence-based rationale" /></label>
          <label>What would change your mind?<textarea value={plan.change_mind_condition} onChange={(e) => update("change_mind_condition", e.target.value)} placeholder="Define the observable invalidation of the thesis" /></label>
          <button className="decision-primary-action" onClick={() => void loadPreview()} disabled={busy}>{busy ? "Calculating..." : "Build Evidence Preview"}</button>
        </section>

        <aside className="decision-preview">
          <div className="decision-preview__heading"><div><span className="decision-eyebrow">Decision context</span><h2>Evidence Preview</h2></div>{preview && <button type="button" onClick={() => setAnalysisOpen(true)}>View Full Analysis</button>}</div>
          {!preview ? <div className="decision-empty">Complete the plan and build a server-verified preview.</div> : <>
            <div className="decision-snapshot-meta"><div><strong>{preview.evidence.summary.replaceAll("_", " ")}</strong><span>{preview.evidence.counts.aligned} aligned · {preview.evidence.counts.conflicting} conflicting</span></div><span>Snapshot {preview.resolved_as_of} · {preview.data_quality.state}</span></div>
            <div className="decision-evidence-list">
              {preview.evidence.items.map((item) => (
                <article className={`evidence-item evidence-item--${item.relationship}`} key={item.key} title={item.explanation}>
                  <div><strong>{item.label.replaceAll("_", " ")}</strong><span>{item.relationship}</span></div>
                  <p>{shortEvidenceExplanation(item)}</p>
                </article>
              ))}
            </div>
            {preview.evidence.counts.conflicting > 0 && <label className="decision-check"><input type="checkbox" checked={conflictsReviewed} onChange={(e) => setConflictsReviewed(e.target.checked)} />I reviewed the contradicting evidence.</label>}
            <div className="decision-risk-card">
              <h3>Position sizing</h3>
              {preview.risk.complete ? <>
                <strong>{String(preview.risk.recommended_quantity)} shares</strong>
                <span>Potential loss: INR {String(preview.risk.potential_loss)}</span>
                <span>Reward-to-risk: {String(preview.risk.reward_to_risk)}R</span>
                <span>Limiting factor: {String(preview.risk.limiting_factor)}</span>
              </> : <span>{String(preview.risk.reason ?? "Not applicable")}</span>}
            </div>
            <button className="decision-primary-action" onClick={() => void submit()} disabled={busy || !conflictsReviewed}>Submit Immutable Decision</button>
          </>}
        </aside>
      </div>
      {preview && analysisOpen && <EvidenceAnalysisOverlay preview={preview} conflictsReviewed={conflictsReviewed} onConflictsReviewed={setConflictsReviewed} onClose={() => setAnalysisOpen(false)} />}
    </main>
  );
}
