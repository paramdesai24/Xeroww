import type { WatchlistSnapshotRow } from "../../../types/platform";

export function WatchlistMetrics({ rows }: { rows: WatchlistSnapshotRow[] }) {
  const advancing = rows.filter((row) => row.available && (row.change ?? 0) > 0).length;
  const declining = rows.filter((row) => row.available && (row.change ?? 0) < 0).length;
  const unavailable = rows.filter((row) => !row.available).length;
  return <section className="watchlist-metrics" aria-label="Watchlist breadth">
    <article><span className="type-label">Symbols tracked</span><strong className="type-metric">{rows.length}</strong><small className="type-meta">Current watchlist</small></article>
    <article><span className="type-label">Advancing</span><strong className="type-metric is-positive">{advancing}</strong><small className="type-meta">Positive day move</small></article>
    <article><span className="type-label">Declining</span><strong className="type-metric is-negative">{declining}</strong><small className="type-meta">Negative day move</small></article>
    <article><span className="type-label">Unavailable</span><strong className="type-metric">{unavailable}</strong><small className="type-meta">Quote not returned</small></article>
  </section>;
}
