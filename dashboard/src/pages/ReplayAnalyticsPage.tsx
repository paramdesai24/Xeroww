import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ReplayAnalytics } from "../types/replayLab";

export default function ReplayAnalyticsPage() {
  const [data, setData] = useState<ReplayAnalytics | null>(null);
  useEffect(() => { api.replayLab.analytics().then(setData).catch(() => setData(null)); }, []);
  return <main className="decision-page intelligence-page"><header className="decision-page__header"><div><p className="decision-eyebrow">Observed practice</p><h1>Replay Analytics</h1><p>Descriptive results only. Every segment includes its sample size.</p></div><Link className="decision-secondary-action" to="/replay-lab">Sessions</Link></header>
    {!data ? <div className="decision-empty">Loading analytics...</div> : <><section className="intelligence-kpis"><article><span>Completed sessions</span><strong>{data.session_count}</strong></article><article><span>Eligible outcomes</span><strong>{data.eligible_outcome_count}</strong></article><article><span>Average R</span><strong>{data.summary.average_r?.toFixed(2) ?? "Unavailable"}</strong></article><article><span>Median R</span><strong>{data.summary.median_r?.toFixed(2) ?? "Unavailable"}</strong></article><article><span>Wins / losses</span><strong>{data.summary.win_count ?? 0} / {data.summary.loss_count ?? 0}</strong></article></section><section className="intelligence-card-grid">{Object.entries(data.groups).map(([group, rows]) => <article key={group}><span>{group.replaceAll("_", " ")}</span>{rows.map((row, index) => <p key={index}><strong>{String(row.key)}</strong> {Number(row.average_r).toFixed(2)}R, n={String(row.sample_size)}</p>)}</article>)}</section></>}
  </main>;
}
