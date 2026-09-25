import type { WatchlistSnapshotRow } from "../../../types/platform";
import { formatFreshness, formatMove, formatPrice } from "../formatters";

export function WatchlistTable({ rows, onMarket, onDecision, onAlert, onRemove }: {
  rows: WatchlistSnapshotRow[];
  onMarket: (symbol: string) => void;
  onDecision: (symbol: string) => void;
  onAlert: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  return <div className="workspace-table-wrap">
    <table className="workspace-table watchlist-table">
      <thead><tr><th scope="col">Company</th><th scope="col">Last price</th><th scope="col">Day move</th><th scope="col">Evidence</th><th scope="col">Actions</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.symbol}>
        <td><button className="watchlist-symbol" onClick={() => onMarket(row.symbol)}><strong className="type-data">{row.symbol.replace(/\.NS$/i, "")}</strong><small className="type-meta">{row.company_name}</small></button></td>
        <td className="type-data">{formatPrice(row.price)}</td>
        <td className={`type-data ${row.change_pct === null ? "" : row.change_pct >= 0 ? "is-positive" : "is-negative"}`}>{formatMove(row.change_pct)}</td>
        <td><span className="type-body">{row.context}</span><small className="type-meta" title={row.reason ?? undefined}>{row.available ? formatFreshness(row.quote_timestamp) : row.reason}</small></td>
        <td><div className="watchlist-row-actions"><button onClick={() => onMarket(row.symbol)}>Market</button><button onClick={() => onDecision(row.symbol)}>Decision</button><button onClick={() => onAlert(row.symbol)}>Alert</button><button className="watchlist-remove" onClick={() => onRemove(row.symbol)} aria-label={`Remove ${row.symbol}`}>Remove</button></div></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
