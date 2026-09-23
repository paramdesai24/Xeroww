import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ReplayReview } from "../types/replayLab";

function value(record: Record<string, unknown>, key: string): string {
  const result = record[key];
  return result == null ? "Unavailable" : String(result);
}

export default function ReplayReviewPage() {
  const id = Number(useParams().sessionId);
  const [review, setReview] = useState<ReplayReview | null>(null);
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.replayLab.review(id).then(setReview).catch((reason) => setError(reason instanceof Error ? reason.message : "Review failed")); }, [id]);
  const saveReflection = async () => { if (!review || !reflection.trim()) return; try { await api.replayLab.reflect(id, review.session.version, "post_session_learning", reflection, "POST_SESSION"); setReview(await api.replayLab.review(id)); setReflection(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Reflection failed"); } };
  if (!review) return <main className="decision-page"><div className={error ? "decision-error" : "decision-empty"}>{error || "Loading review..."}</div></main>;
  return <main className="decision-page intelligence-page">
    <header className="decision-page__header"><div><p className="decision-eyebrow">Process before outcome</p><h1>Session Review</h1><p>{review.session.symbol} · {review.session.timeframe} · {review.session.completion_reason?.replaceAll("_", " ")}</p></div><Link className="decision-secondary-action" to="/replay-lab">All Sessions</Link></header>
    {error && <div className="decision-error">{error}</div>}
    <section className="intelligence-kpis"><article><span>Process score</span><strong>{review.process.score == null ? "Unavailable" : `${review.process.score}/100`}</strong></article><article><span>Process grade</span><strong>{review.process.grade || "Unavailable"}</strong></article><article><span>Realized result</span><strong>{value(review.outcome, "realized_r_multiple")}R</strong></article><article><span>Maximum favourable</span><strong>{value(review.outcome, "maximum_favourable_excursion_r")}R</strong></article><article><span>Maximum adverse</span><strong>{value(review.outcome, "maximum_adverse_excursion_r")}R</strong></article></section>
    <section className="intelligence-workspace">
      <div className="intelligence-main"><h2>Process rubric</h2><div className="intelligence-card-grid">{Object.entries(review.process.components).map(([key, component]) => <article key={key}><span>{key.replaceAll("_", " ")}</span><strong>{String(component.earned ?? 0)} / {String(component.maximum ?? 0)}</strong><p>{String(component.short_explanation ?? "Rule-based process assessment")}</p></article>)}</div></div>
      <aside className="intelligence-aside"><div><h2>Private observations</h2>{review.behaviour_observations.length ? review.behaviour_observations.map((item, index) => <p key={index}>{String(item.observation ?? item.label ?? JSON.stringify(item))}</p>) : <p>At least five completed sessions are required before behaviour patterns are shown.</p>}</div><div><label>What will you repeat or change?<textarea value={reflection} onChange={(event) => setReflection(event.target.value)} /></label><button className="decision-primary-action" onClick={() => void saveReflection()}>Save Reflection</button></div></aside>
    </section>
  </main>;
}
