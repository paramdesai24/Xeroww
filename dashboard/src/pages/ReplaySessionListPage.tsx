import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ReplaySessionSummary } from "../types/replayLab";

export default function ReplaySessionListPage() {
  const [sessions, setSessions] = useState<ReplaySessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.replayLab.list().then((value) => setSessions(value.items)).catch((reason) => setError(String(reason))); }, []);
  return <main className="decision-page intelligence-page">
    <header className="decision-page__header"><div><p className="decision-eyebrow">Deliberate practice</p><h1>Replay Lab</h1><p>Make point-in-time decisions, reveal one candle, then review process separately from outcome.</p></div><div className="decision-header-actions"><Link className="decision-secondary-action" to="/replay-lab/analytics">Analytics</Link><Link className="decision-primary-action" to="/replay-lab/new">New Session</Link></div></header>
    {error && <div className="decision-error">{error}</div>}
    <section className="intelligence-list">
      {sessions.map((session) => <Link key={session.id} to={session.status === "COMPLETED" ? `/replay-lab/${session.id}/review` : `/replay-lab/${session.id}`} className="intelligence-list__row">
        <div><strong>{session.symbol}</strong><span>{session.setup_category || "Unclassified setup"}</span></div>
        <div><strong>{session.status.replaceAll("_", " ")}</strong><span>{session.timeframe} · step {session.current_index - session.start_index + 1}</span></div>
        <div><strong>{session.process_score == null ? "Not scored" : `${session.process_score}/100`}</strong><span>{new Date(session.created_at).toLocaleDateString("en-IN")}</span></div>
      </Link>)}
      {!sessions.length && !error && <div className="decision-empty">No replay sessions yet. Start with one symbol and a short 20-bar window.</div>}
    </section>
  </main>;
}
