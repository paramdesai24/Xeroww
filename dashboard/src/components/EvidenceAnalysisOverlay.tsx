import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { DecisionPreview } from "../types/decision";

interface EvidenceAnalysisOverlayProps {
  preview: DecisionPreview;
  conflictsReviewed: boolean;
  onConflictsReviewed: (reviewed: boolean) => void;
  onClose: () => void;
}

export default function EvidenceAnalysisOverlay({
  preview,
  conflictsReviewed,
  onConflictsReviewed,
  onClose,
}: EvidenceAnalysisOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="evidence-analysis" role="dialog" aria-modal="true" aria-labelledby="evidence-analysis-title">
      <header className="evidence-analysis__header">
        <div>
          <p className="decision-eyebrow">Server-verified snapshot</p>
          <h1 id="evidence-analysis-title">Full Evidence Analysis</h1>
          <p>Complete reasoning, captured as of {preview.resolved_as_of}.</p>
        </div>
        <button className="evidence-analysis__close" type="button" onClick={onClose} aria-label="Close full analysis">Close</button>
      </header>

      <div className="evidence-analysis__summary">
        <div><span>Assessment</span><strong>{preview.evidence.summary.replaceAll("_", " ")}</strong></div>
        <div><span>Aligned</span><strong>{preview.evidence.counts.aligned}</strong></div>
        <div><span>Conflicting</span><strong>{preview.evidence.counts.conflicting}</strong></div>
        <div><span>Contextual</span><strong>{preview.evidence.counts.contextual}</strong></div>
        <div><span>Data quality</span><strong>{preview.data_quality.state}</strong></div>
      </div>

      <div className="evidence-analysis__layout">
        <section className="evidence-analysis__items" aria-label="Evidence details">
          {preview.evidence.items.map((item) => (
            <article className={`evidence-detail evidence-item--${item.relationship}`} key={item.key}>
              <div className="evidence-detail__heading">
                <div><span>{item.category}</span><h2>{item.label.replaceAll("_", " ")}</h2></div>
                <strong>{item.relationship}</strong>
              </div>
              <p>{item.explanation}</p>
              <footer>{item.source_engine.replaceAll("_", " ")}</footer>
            </article>
          ))}
        </section>

        <aside className="evidence-analysis__aside">
          <section>
            <span className="evidence-analysis__label">Data quality</span>
            <strong>{preview.data_quality.state}</strong>
            <p>{preview.data_quality.note}</p>
          </section>
          <section>
            <span className="evidence-analysis__label">Position sizing</span>
            {preview.risk.complete ? <>
              <strong>{String(preview.risk.recommended_quantity)} shares</strong>
              <dl>
                <div><dt>Potential loss</dt><dd>INR {String(preview.risk.potential_loss)}</dd></div>
                <div><dt>Reward-to-risk</dt><dd>{String(preview.risk.reward_to_risk)}R</dd></div>
                <div><dt>Limiting factor</dt><dd>{String(preview.risk.limiting_factor)}</dd></div>
              </dl>
            </> : <p>{String(preview.risk.reason ?? "Not applicable to this intent.")}</p>}
          </section>
          <p className="evidence-analysis__method">{preview.evidence.methodology_note}</p>
          {preview.evidence.counts.conflicting > 0 && (
            <label className="decision-check decision-check--boxed">
              <input type="checkbox" checked={conflictsReviewed} onChange={(event) => onConflictsReviewed(event.target.checked)} />
              I reviewed the conflicting evidence.
            </label>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
