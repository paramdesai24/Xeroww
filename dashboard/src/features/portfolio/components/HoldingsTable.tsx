import { useMemo, useState } from "react";
import type { Holding } from "../../../types/platform";
import { formatMoney, formatPercent, formatQuantity } from "../formatters";

type Sort = "value" | "pnl" | "allocation" | "symbol";

export function HoldingsTable({ holdings, onMarket, onDecision, onSell }: { holdings: Holding[]; onMarket: (symbol: string) => void; onDecision: (symbol: string) => void; onSell: (symbol: string) => void }) {
  const [sort, setSort] = useState<Sort>("value");
  const sorted = useMemo(() => holdings.slice().sort((a, b) => {
    if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
    if (sort === "pnl") return (b.unrealized_pnl ?? -Infinity) - (a.unrealized_pnl ?? -Infinity);
    if (sort === "allocation") return (b.allocation_pct ?? -Infinity) - (a.allocation_pct ?? -Infinity);
    return (b.current_value ?? -Infinity) - (a.current_value ?? -Infinity);
  }), [holdings, sort]);

  return (
    <section className="workspace-panel">
      <div className="workspace-panel__header"><div><h2>Holdings</h2><span>Live valuation may be delayed</span></div><select aria-label="Sort holdings" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="value">Value</option><option value="pnl">P&L</option><option value="allocation">Allocation</option><option value="symbol">Symbol</option></select></div>
      <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Symbol</th><th>Quantity</th><th>Average</th><th>Current</th><th>Value</th><th>P&amp;L</th><th>Allocation</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{sorted.map((holding) => <tr key={holding.symbol}><td><button className="workspace-symbol" onClick={() => onMarket(holding.symbol)}>{holding.symbol}</button></td><td>{formatQuantity(holding.quantity)}</td><td>{formatMoney(holding.average_price)}</td><td>{formatMoney(holding.current_price)}</td><td>{formatMoney(holding.current_value)}</td><td className={(holding.unrealized_pnl ?? 0) >= 0 ? "is-positive" : "is-negative"}>{formatMoney(holding.unrealized_pnl)}<small>{formatPercent(holding.unrealized_pnl_pct)}</small></td><td>{formatPercent(holding.allocation_pct)}</td><td><div className="workspace-row-actions"><button onClick={() => onDecision(holding.symbol)}>Decision</button><button onClick={() => onSell(holding.symbol)}>Sell</button></div></td></tr>)}</tbody></table></div>
    </section>
  );
}
