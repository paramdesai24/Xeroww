import type { WatchlistSnapshotRow } from "../../../types/platform";
import { MetricCard } from "../../../components/ui";

export function WatchlistMetrics({ rows }: { rows: WatchlistSnapshotRow[] }) {
  const advancing = rows.filter((row) => row.available && (row.change ?? 0) > 0).length;
  const declining = rows.filter((row) => row.available && (row.change ?? 0) < 0).length;
  const unavailable = rows.filter((row) => !row.available).length;
  return <section className="watchlist-metrics" aria-label="Watchlist breadth">
    <MetricCard label="Symbols tracked" value={rows.length} note="Current watchlist" />
    <MetricCard label="Advancing" value={advancing} note="Positive day move" tone="positive" />
    <MetricCard label="Declining" value={declining} note="Negative day move" tone="negative" />
    <MetricCard label="Unavailable" value={unavailable} note="Quote not returned" />
  </section>;
}
