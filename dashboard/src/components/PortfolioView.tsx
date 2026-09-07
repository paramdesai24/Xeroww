// src/components/PortfolioView.tsx
// Simulated portfolio manager: live valuations, BUY/SELL orders, transaction history.
// Graphite-and-paper design system.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Portfolio, PortfolioSummary, Transaction } from "../types/platform";

function pnlColor(v: number | null): string {
  if (v === null) return "text-[var(--text-tertiary)]";
  return v >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

function fmt(v: number | null, prefix = "₹"): string {
  if (v === null) return "—";
  return `${prefix}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function PortfolioView() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [active, setActive] = useState<PortfolioSummary | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [newPortName, setNewPortName] = useState("");
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeSide, setTradeSide] = useState<"BUY" | "SELL">("BUY");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"holdings" | "contributions" | "transactions" | "trade">("holdings");
  const [contrib, setContrib] = useState<import("../types/structure").PortfolioContributionResponse | null>(null);

  const loadPortfolios = useCallback(async () => {
    try {
      const list = await api.portfolios.list();
      setPortfolios(list);
      if (list.length > 0) {
        const summary = await api.portfolios.get(list[0].id);
        setActive(summary);
        const t = await api.portfolios.transactions(list[0].id);
        setTxns(t);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPortfolios(); }, [loadPortfolios]);

  useEffect(() => {
    if (tab === "contributions" && active) {
      api.portfolioContributions.get(active.id).then(setContrib).catch(() => setContrib(null));
    }
  }, [tab, active]);

  const selectPortfolio = async (id: number) => {
    const summary = await api.portfolios.get(id);
    setActive(summary);
    const t = await api.portfolios.transactions(id);
    setTxns(t);
    if (tab === "contributions") {
      api.portfolioContributions.get(id).then(setContrib).catch(() => setContrib(null));
    }
  };

  const createPortfolio = async () => {
    if (!newPortName.trim()) return;
    await api.portfolios.create(newPortName.trim());
    setNewPortName("");
    await loadPortfolios();
  };

  const executeTrade = async () => {
    if (!active || !tradeSymbol.trim() || !tradeQty) return;
    setTradeError(null);
    setTradeSuccess(null);
    try {
      await api.portfolios.trade(
        active.id,
        tradeSymbol.trim().toUpperCase(),
        tradeSide,
        parseFloat(tradeQty),
        tradePrice ? parseFloat(tradePrice) : undefined,
      );
      setTradeSuccess(`${tradeSide} order executed for ${tradeSymbol.toUpperCase()}`);
      setTradeQty("");
      setTradePrice("");
      const summary = await api.portfolios.get(active.id);
      setActive(summary);
      const t = await api.portfolios.transactions(active.id);
      setTxns(t);
    } catch (e) {
      setTradeError(e instanceof Error ? e.message : "Trade failed");
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[var(--surface-base)]">
      <span className="text-[11px] text-[var(--text-tertiary)] tracking-widest font-mono animate-pulse">LOADING PORTFOLIOS…</span>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden font-mono bg-[var(--surface-base)]">
      {/* Portfolio sidebar */}
      <div className="w-52 shrink-0 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--surface-raised)]">
        <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] tracking-widest text-[var(--text-tertiary)] font-bold">PORTFOLIOS</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {portfolios.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPortfolio(p.id)}
              className={`px-3 py-2.5 border-b border-[var(--border-subtle)] cursor-pointer transition-colors ${
                active?.id === p.id ? "bg-[var(--surface-overlay)] border-l-2 border-l-[var(--accent)]" : "hover:bg-[var(--surface-base)]"
              }`}
            >
              <div className={`text-xs ${active?.id === p.id ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"}`}>{p.name}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                {fmt(p.cash_balance)} CASH
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border-subtle)] p-3 bg-[var(--surface-raised)]">
          <div className="flex gap-1">
            <input
              value={newPortName}
              onChange={(e) => setNewPortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPortfolio()}
              placeholder="New portfolio"
              className="flex-1 bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-2 py-1.5 outline-none focus:border-[var(--border-strong)] placeholder-[var(--text-tertiary)]"
            />
            <button
              onClick={createPortfolio}
              className="text-[10px] px-2.5 bg-[var(--surface-overlay)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-bold transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main panel */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-base)]">
          {/* Summary bar */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] grid grid-cols-4 gap-4">
            {[
              { label: "TOTAL VALUE", value: fmt(active.total_value), color: "text-[var(--text-primary)]" },
              { label: "CASH", value: fmt(active.cash_balance), color: "text-[var(--text-secondary)]" },
              { label: "HOLDINGS", value: fmt(active.holdings_value), color: "text-[var(--text-primary)]" },
              {
                label: "UNREALIZED P&L",
                value: `${fmt(active.total_unrealized_pnl)} (${active.total_unrealized_pnl_pct?.toFixed(2)}%)`,
                color: pnlColor(active.total_unrealized_pnl),
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-[10px] text-[var(--text-tertiary)] tracking-widest">{label}</div>
                <div className={`text-xs font-bold tabular-nums mt-0.5 ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tab strip */}
          <div className="flex border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
            {(["holdings", "contributions", "transactions", "trade"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-[10px] tracking-widest font-bold border-r border-[var(--border-subtle)] transition-colors ${
                  tab === t
                    ? "text-[var(--text-primary)] bg-[var(--surface-raised)] border-b-2 border-b-[var(--accent)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]"
                }`}
              >
                {t === "contributions" ? "TODAY'S CONTRIBUTION" : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Holdings */}
          {tab === "holdings" && (
            <div className="flex-1 overflow-y-auto">
              {active.holdings.length === 0 ? (
                <div className="p-4 text-[11px] text-[var(--text-tertiary)] tracking-wider">NO HOLDINGS · EXECUTE A BUY TRADE</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-tertiary)] tracking-widest">
                      {["SYMBOL", "QTY", "AVG PRICE", "CURR PRICE", "VALUE", "P&L", "ALLOC"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.holdings.map((h) => (
                      <tr key={h.symbol} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] transition-colors">
                        <td className="px-4 py-2 text-[var(--text-primary)] font-bold">{h.symbol}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{h.quantity}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)] tabular-nums">{fmt(h.average_price)}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{fmt(h.current_price)}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{fmt(h.current_value)}</td>
                        <td className={`px-4 py-2 tabular-nums ${pnlColor(h.unrealized_pnl)}`}>
                          {fmt(h.unrealized_pnl)} ({h.unrealized_pnl_pct?.toFixed(1)}%)
                        </td>
                        <td className="px-4 py-2 text-[var(--text-tertiary)] tabular-nums">{h.allocation_pct?.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Today's Contribution Diff */}
          {tab === "contributions" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Highlight cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest">LARGEST CONTRIBUTOR</div>
                  {contrib?.largest_contributor ? (
                    <div className="mt-1">
                      <span className="text-xs font-bold text-[var(--positive)] mr-2">{contrib.largest_contributor.symbol}</span>
                      <span className="text-[11px] text-[var(--positive)] tabular-nums">+{fmt(contrib.largest_contributor.pnl_contribution_inr)} ({contrib.largest_contributor.pnl_contribution_pct}%)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-1">— None today</div>
                  )}
                </div>

                <div className="p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest">LARGEST DETRACTOR</div>
                  {contrib?.largest_detractor ? (
                    <div className="mt-1">
                      <span className="text-xs font-bold text-[var(--negative)] mr-2">{contrib.largest_detractor.symbol}</span>
                      <span className="text-[11px] text-[var(--negative)] tabular-nums">{fmt(contrib.largest_detractor.pnl_contribution_inr)} ({contrib.largest_detractor.pnl_contribution_pct}%)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-1">— None today</div>
                  )}
                </div>

                <div className="p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest">DAY P&amp;L CONTRIBUTION</div>
                  <div className="mt-1">
                    <span className={`text-xs font-bold tabular-nums ${pnlColor(contrib?.day_pnl_inr ?? 0)}`}>
                      {fmt(contrib?.day_pnl_inr ?? 0)} ({contrib?.day_pnl_pct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-tertiary)] tracking-widest">
                    {["SYMBOL", "QTY", "PRICE", "MOVE", "VALUE", "P&L CONTRIBUTION", "PORTFOLIO ALLOC"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contrib?.holdings.map((h) => (
                    <tr key={h.symbol} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] transition-colors">
                      <td className="px-4 py-2 text-[var(--text-primary)] font-bold">{h.symbol}</td>
                      <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{h.quantity}</td>
                      <td className="px-4 py-2 text-[var(--text-secondary)] tabular-nums">{fmt(h.current_price)}</td>
                      <td className={`px-4 py-2 tabular-nums ${pnlColor(h.price_change)}`}>
                        {h.price_change > 0 ? "+" : ""}{h.price_change.toFixed(2)} ({h.price_change_pct > 0 ? "+" : ""}{h.price_change_pct}%)
                      </td>
                      <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{fmt(h.current_value)}</td>
                      <td className={`px-4 py-2 font-bold tabular-nums ${pnlColor(h.pnl_contribution_inr)}`}>
                        {h.pnl_contribution_inr > 0 ? "+" : ""}{fmt(h.pnl_contribution_inr)} ({h.pnl_contribution_pct}%)
                      </td>
                      <td className="px-4 py-2 text-[var(--text-tertiary)] tabular-nums">{h.allocation_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transactions */}
          {tab === "transactions" && (
            <div className="flex-1 overflow-y-auto">
              {txns.length === 0 ? (
                <div className="p-4 text-[11px] text-[var(--text-tertiary)] tracking-wider">NO TRANSACTIONS YET</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-tertiary)] tracking-widest">
                      {["TIMESTAMP", "SYMBOL", "SIDE", "QTY", "PRICE", "REALIZED P&L"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] transition-colors">
                        <td className="px-4 py-2 text-[var(--text-tertiary)] tabular-nums">{new Date(t.timestamp).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] font-bold">{t.symbol}</td>
                        <td className={`px-4 py-2 font-bold ${t.side === "BUY" ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>{t.side}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{t.quantity}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] tabular-nums">{fmt(t.execution_price)}</td>
                        <td className={`px-4 py-2 tabular-nums ${pnlColor(t.realized_pnl)}`}>{fmt(t.realized_pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Trade form */}
          {tab === "trade" && (
            <div className="p-6 max-w-sm space-y-4">
              <div className="text-[10px] tracking-widest text-[var(--text-tertiary)] mb-2">
                PAPER TRADE — NO REAL MONEY
              </div>

              {tradeError && (
                <div className="text-[10px] text-[var(--negative)] border border-[var(--negative)]/20 bg-[var(--negative-subtle)] px-3 py-2">
                  {tradeError}
                </div>
              )}
              {tradeSuccess && (
                <div className="text-[10px] text-[var(--positive)] border border-[var(--positive)]/20 bg-[var(--positive-subtle)] px-3 py-2">
                  {tradeSuccess}
                </div>
              )}

              {[
                { label: "SYMBOL", value: tradeSymbol, onChange: (v: string) => setTradeSymbol(v.toUpperCase()), placeholder: "RELIANCE.NS" },
                { label: "QUANTITY", value: tradeQty, onChange: setTradeQty, placeholder: "10" },
                { label: "LIMIT PRICE (optional)", value: tradePrice, onChange: setTradePrice, placeholder: "Live market price" },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label}>
                  <label className="block text-[10px] tracking-widest text-[var(--text-tertiary)] mb-1.5">{label}</label>
                  <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs px-3 py-2 outline-none focus:border-[var(--border-strong)] placeholder-[var(--text-tertiary)]"
                  />
                </div>
              ))}

              <div className="flex gap-2">
                {(["BUY", "SELL"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setTradeSide(side)}
                    className={`flex-1 py-2 text-[10px] font-bold tracking-widest transition-colors ${
                      tradeSide === side
                        ? side === "BUY"
                          ? "bg-[var(--positive-subtle)] border border-[var(--positive)]/40 text-[var(--positive)]"
                          : "bg-[var(--negative-subtle)] border border-[var(--negative)]/40 text-[var(--negative)]"
                        : "bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>

              <button
                onClick={executeTrade}
                className="w-full py-2.5 text-[10px] font-bold tracking-widest bg-[var(--surface-raised)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
              >
                EXECUTE {tradeSide} ORDER
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-[var(--text-tertiary)] tracking-widest">CREATE OR SELECT A PORTFOLIO</span>
        </div>
      )}
    </div>
  );
}
