import { useNavigate } from "react-router-dom";
import type { QuoteData, StockMeta } from "../../types/market";
import Sparkline from "./Sparkline";
import CompanyLogo from "./CompanyLogo";

export default function MoverPanel({ title, rows, stocks, mode = "change" }: { title: string; rows: QuoteData[]; stocks: StockMeta[]; mode?: "change" | "volume" }) {
  const navigate = useNavigate();
  const company = new Map(stocks.map((stock) => [stock.symbol, stock]));
  return <section className="market-panel mover-panel"><header><h2>{title}</h2><span>{rows.length ? `Top ${rows.length}` : "No matches"}</span></header><div>{rows.length === 0 && <p className="mover-panel__empty">No stocks match the current filters.</p>}{rows.slice(0, 5).map((quote) => {
    const positive = quote.change_pct >= 0;
    const seed = quote.price - quote.change;
    return <button key={quote.symbol} className="mover-row" type="button" onClick={() => navigate(`/stocks/${quote.symbol.replace(/\.NS$/, "")}`)}><span className="mover-row__company"><CompanyLogo symbol={quote.symbol} size="small" /><span className="mover-row__identity"><strong>{quote.symbol.replace(/\.NS$/, "")}</strong><small title={company.get(quote.symbol)?.display_name ?? quote.display_name}>{company.get(quote.symbol)?.display_name ?? quote.display_name}</small><small className="mover-row__sector">{company.get(quote.symbol)?.sector ?? "Equity"}</small></span></span><Sparkline values={[seed, seed + quote.change * .3, seed - quote.change * .15, seed + quote.change * .7, quote.price]} positive={positive} /><span className="mover-row__value"><strong>₹{quote.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong><small className={positive ? "is-positive" : "is-negative"}>{mode === "volume" ? `${(quote.volume / 1e5).toFixed(1)}L` : `${positive ? "+" : ""}${quote.change_pct.toFixed(2)}%`}</small></span></button>;
  })}</div></section>;
}
