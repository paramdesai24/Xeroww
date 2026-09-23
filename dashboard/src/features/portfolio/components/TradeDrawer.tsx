import { useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import type { AppError } from "../../../api/errors";
import type { PortfolioSummary } from "../../../types/platform";
import type { StockMeta } from "../../../types/market";
import { ErrorNotice, FieldError } from "../../../components/ui";
import { formatMoney, formatQuantity } from "../formatters";

export function TradeDrawer({ open, portfolio, initialSymbol, busy, apiError, onClose, onPlan, onSubmit }: { open: boolean; portfolio: PortfolioSummary; initialSymbol?: string; busy: boolean; apiError: AppError | null; onClose: () => void; onPlan: (symbol: string) => void; onSubmit: (input: { symbol: string; side: "BUY" | "SELL"; quantity: number; limitPrice?: number }) => Promise<void> }) {
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [symbol, setSymbol] = useState(initialSymbol ?? "");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => { if (open) void api.getStocks().then(setStocks).catch(() => setStocks([])); }, [open]);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, onClose]);

  const matches = useMemo(() => {
    const query = symbol.trim().toUpperCase();
    if (!query) return [];
    return stocks.filter((stock) => stock.symbol.toUpperCase().includes(query) || stock.display_name.toUpperCase().includes(query)).sort((a, b) => {
      const aPrefix = a.symbol.toUpperCase().startsWith(query) || a.display_name.toUpperCase().startsWith(query);
      const bPrefix = b.symbol.toUpperCase().startsWith(query) || b.display_name.toUpperCase().startsWith(query);
      return Number(bPrefix) - Number(aPrefix) || a.symbol.localeCompare(b.symbol);
    }).slice(0, 6);
  }, [stocks, symbol]);
  const numericQuantity = Number(quantity);
  const numericPrice = price ? Number(price) : undefined;
  const estimate = Number.isFinite(numericQuantity) && numericPrice && Number.isFinite(numericPrice) ? numericQuantity * numericPrice : null;
  const owned = portfolio.holdings.find((holding) => holding.symbol === symbol.trim().toUpperCase())?.quantity ?? 0;

  const continueToConfirm = () => {
    if (!symbol.trim()) return setLocalError("Choose a symbol.");
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return setLocalError("Enter a quantity above zero.");
    if (numericPrice !== undefined && (!Number.isFinite(numericPrice) || numericPrice <= 0)) return setLocalError("Enter a valid execution price.");
    if (side === "SELL" && numericQuantity > owned) return setLocalError(`You currently hold ${formatQuantity(owned)} units.`);
    setLocalError(null);
    setConfirming(true);
  };
  const submit = async () => {
    try {
      await onSubmit({ symbol: symbol.trim().toUpperCase(), side, quantity: numericQuantity, limitPrice: numericPrice });
      onClose();
    } catch {
      setConfirming(false);
    }
  };
  if (!open) return null;

  return <div className="workspace-drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="workspace-drawer" role="dialog" aria-modal="true" aria-labelledby="trade-drawer-title"><header><div><p className="decision-eyebrow">Immutable paper ledger</p><h2 id="trade-drawer-title">{confirming ? "Confirm Trade" : "Record Trade"}</h2></div><button onClick={onClose} aria-label="Close trade drawer">Close</button></header>{apiError && <ErrorNotice error={apiError} />}{confirming ? <div className="trade-confirm"><dl><div><dt>Portfolio</dt><dd>{portfolio.name}</dd></div><div><dt>Order</dt><dd>{side} {formatQuantity(numericQuantity)} {symbol.trim().toUpperCase()}</dd></div><div><dt>Execution</dt><dd>{numericPrice ? formatMoney(numericPrice) : "Current provider price"}</dd></div><div><dt>Estimated value</dt><dd>{estimate ? formatMoney(estimate) : "Calculated at execution"}</dd></div>{side === "BUY" ? <div><dt>Available cash</dt><dd>{formatMoney(portfolio.cash_balance)}</dd></div> : <div><dt>Owned quantity</dt><dd>{formatQuantity(owned)}</dd></div>}</dl><p>This simulated transaction becomes part of the permanent activity ledger.</p><div className="workspace-drawer__actions"><button className="workspace-button" disabled={busy} onClick={() => setConfirming(false)}>Back</button><button className="decision-primary-action" disabled={busy} onClick={() => void submit()}>{busy ? "Recording" : `Confirm ${side}`}</button></div></div> : <div className="workspace-drawer__body"><div className="workspace-segmented"><button className={side === "BUY" ? "is-active" : ""} onClick={() => setSide("BUY")}>Buy</button><button className={side === "SELL" ? "is-active" : ""} onClick={() => setSide("SELL")}>Sell</button></div><label>Symbol<input autoFocus value={symbol} onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setLocalError(null); }} placeholder="Search ticker or company" /></label>{matches.length > 0 && <div className="symbol-suggestions">{matches.map((stock) => <button key={stock.symbol} onClick={() => setSymbol(stock.symbol)}><strong>{stock.symbol}</strong><span>{stock.display_name}</span></button>)}</div>}<label>Quantity<input inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(event.target.value); setLocalError(null); }} placeholder="10" /></label><label>Execution price <small>Optional</small><input inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); setLocalError(null); }} placeholder="Use current provider price" /></label><FieldError message={localError ?? undefined} /><div className="trade-preview"><span>Estimated order value</span><strong>{estimate ? formatMoney(estimate) : "At execution"}</strong></div><p className="workspace-note">Paper execution only. Provider prices may be delayed.</p><div className="workspace-drawer__actions"><button className="decision-secondary-action" disabled={!symbol.trim()} onClick={() => onPlan(symbol.trim().toUpperCase())}>Plan First</button><button className="decision-primary-action" onClick={continueToConfirm}>Review Trade</button></div></div>}</aside></div>;
}
