// src/components/PortfolioView.tsx
// Simulated portfolio manager: live valuations, BUY/SELL orders, transaction history.
// Graphite-and-paper design system.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Portfolio, PortfolioSummary, Transaction } from "../types/platform";

function pnlColor(v: number | null): string {
  if (v === null) return "text-[#64748B]";
  return v >= 0 ? "text-[#22C55E]" : "text-[#EF4444]";
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
    <div className="flex-1 flex items-center justify-center bg-[#000000]">
      <span className="text-xs text-[#64748B] font-mono animate-pulse">Loading portfolios…</span>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-[#000000] text-[#F8FAFC]">
      {/* Portfolio sidebar */}
      <div className="w-56 shrink-0 border-r border-[#1E2538] flex flex-col bg-[#05070B]">
        <div className="px-4 py-3 border-b border-[#1E2538] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#94A3B8]">Portfolios</span>
          <span className="text-[11px] font-mono text-[#64748B]">{portfolios.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {portfolios.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPortfolio(p.id)}
              className={`px-4 py-3 border-b border-[#1E2538]/60 cursor-pointer transition-colors ${
                active?.id === p.id
                  ? "bg-[#10141D] border-l-2 border-l-[#1E90FF]"
                  : "hover:bg-[#0B0E14] border-l-2 border-l-transparent"
              }`}
            >
              <div className={`text-xs ${active?.id === p.id ? "text-[#F8FAFC] font-semibold" : "text-[#94A3B8]"}`}>
                {p.name}
              </div>
              <div className="text-[11px] text-[#64748B] font-mono mt-0.5 tabular-nums">
                {fmt(p.cash_balance)} cash
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#1E2538] p-3 bg-[#0B0E14]">
          <div className="flex gap-1.5">
            <input
              value={newPortName}
              onChange={(e) => setNewPortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPortfolio()}
              placeholder="New portfolio name"
              className="flex-1 bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-2.5 py-1.5 outline-none placeholder-[#64748B] transition-colors"
            />
            <button
              onClick={createPortfolio}
              className="px-3 bg-[#1E2538] hover:bg-[#2A344D] text-[#F8FAFC] text-xs font-semibold transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main panel */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
          {/* Summary bar */}
          <div className="px-4 py-3 border-b border-[#1E2538] bg-[#05070B] grid grid-cols-4 gap-4">
            {[
              { label: "Total Value", value: fmt(active.total_value), color: "text-[#F8FAFC]" },
              { label: "Cash Balance", value: fmt(active.cash_balance), color: "text-[#94A3B8]" },
              { label: "Holdings Value", value: fmt(active.holdings_value), color: "text-[#F8FAFC]" },
              {
                label: "Unrealized P&L",
                value: `${fmt(active.total_unrealized_pnl)} (${active.total_unrealized_pnl_pct?.toFixed(2)}%)`,
                color: pnlColor(active.total_unrealized_pnl),
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-2.5 bg-[#0B0E14] border border-[#1E2538]">
                <div className="text-[11px] text-[#64748B]">{label}</div>
                <div className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tab strip */}
          <div className="flex border-b border-[#1E2538] bg-[#05070B]">
            {[
              { id: "holdings", label: "Holdings" },
              { id: "contributions", label: "Today's Contribution" },
              { id: "transactions", label: "Transactions" },
              { id: "trade", label: "Trade" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-4 py-2.5 text-xs font-medium border-r border-[#1E2538] transition-colors ${
                  tab === t.id
                    ? "text-[#F8FAFC] bg-[#0B0E14] border-b-2 border-b-[#1E90FF] font-semibold"
                    : "text-[#64748B] hover:text-[#94A3B8] hover:bg-[#0B0E14]/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Holdings */}
          {tab === "holdings" && (
            <div className="flex-1 overflow-y-auto">
              {active.holdings.length === 0 ? (
                <div className="p-6 text-xs text-[#64748B]">No holdings in this portfolio. Execute a Buy trade to start.</div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1E2538] bg-[#05070B] text-[#64748B] font-sans">
                      {["Symbol", "Qty", "Avg Price", "Current Price", "Value", "P&L", "Allocation"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.holdings.map((h) => (
                      <tr key={h.symbol} className="border-b border-[#1E2538]/60 hover:bg-[#0B0E14] transition-colors">
                        <td className="px-4 py-2.5 text-[#F8FAFC] font-semibold">{h.symbol}</td>
                        <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{h.quantity}</td>
                        <td className="px-4 py-2.5 text-[#94A3B8] tabular-nums">{fmt(h.average_price)}</td>
                        <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{fmt(h.current_price)}</td>
                        <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{fmt(h.current_value)}</td>
                        <td className={`px-4 py-2.5 tabular-nums font-semibold ${pnlColor(h.unrealized_pnl)}`}>
                          {fmt(h.unrealized_pnl)} ({h.unrealized_pnl_pct?.toFixed(1)}%)
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B] tabular-nums">{h.allocation_pct?.toFixed(1)}%</td>
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
                <div className="p-3 bg-[#0B0E14] border border-[#1E2538]">
                  <div className="text-[11px] text-[#64748B]">Largest Contributor</div>
                  {contrib?.largest_contributor ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#22C55E] font-mono">{contrib.largest_contributor.symbol}</span>
                      <span className="text-xs text-[#22C55E] font-mono tabular-nums">+{fmt(contrib.largest_contributor.pnl_contribution_inr)} ({contrib.largest_contributor.pnl_contribution_pct}%)</span>
                    </div>
                  ) : (
                    <div className="text-xs text-[#64748B] mt-1">— None today</div>
                  )}
                </div>

                <div className="p-3 bg-[#0B0E14] border border-[#1E2538]">
                  <div className="text-[11px] text-[#64748B]">Largest Detractor</div>
                  {contrib?.largest_detractor ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#EF4444] font-mono">{contrib.largest_detractor.symbol}</span>
                      <span className="text-xs text-[#EF4444] font-mono tabular-nums">{fmt(contrib.largest_detractor.pnl_contribution_inr)} ({contrib.largest_detractor.pnl_contribution_pct}%)</span>
                    </div>
                  ) : (
                    <div className="text-xs text-[#64748B] mt-1">— None today</div>
                  )}
                </div>

                <div className="p-3 bg-[#0B0E14] border border-[#1E2538]">
                  <div className="text-[11px] text-[#64748B]">Day P&amp;L Contribution</div>
                  <div className="mt-1">
                    <span className={`text-xs font-bold font-mono tabular-nums ${pnlColor(contrib?.day_pnl_inr ?? 0)}`}>
                      {fmt(contrib?.day_pnl_inr ?? 0)} ({contrib?.day_pnl_pct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1E2538] bg-[#05070B] text-[#64748B] font-sans">
                    {["Symbol", "Qty", "Price", "Move", "Value", "P&L Contribution", "Portfolio Alloc"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contrib?.holdings.map((h) => (
                    <tr key={h.symbol} className="border-b border-[#1E2538]/60 hover:bg-[#0B0E14] transition-colors">
                      <td className="px-4 py-2.5 text-[#F8FAFC] font-semibold">{h.symbol}</td>
                      <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{h.quantity}</td>
                      <td className="px-4 py-2.5 text-[#94A3B8] tabular-nums">{fmt(h.current_price)}</td>
                      <td className={`px-4 py-2.5 tabular-nums font-semibold ${pnlColor(h.price_change)}`}>
                        {h.price_change > 0 ? "+" : ""}{h.price_change.toFixed(2)} ({h.price_change_pct > 0 ? "+" : ""}{h.price_change_pct}%)
                      </td>
                      <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{fmt(h.current_value)}</td>
                      <td className={`px-4 py-2.5 font-bold tabular-nums ${pnlColor(h.pnl_contribution_inr)}`}>
                        {h.pnl_contribution_inr > 0 ? "+" : ""}{fmt(h.pnl_contribution_inr)} ({h.pnl_contribution_pct}%)
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B] tabular-nums">{h.allocation_pct}%</td>
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
                <div className="p-6 text-xs text-[#64748B]">No transactions recorded yet.</div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1E2538] bg-[#05070B] text-[#64748B] font-sans">
                      {["Timestamp", "Symbol", "Side", "Qty", "Price", "Realized P&L"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id} className="border-b border-[#1E2538]/60 hover:bg-[#0B0E14] transition-colors">
                        <td className="px-4 py-2.5 text-[#64748B] tabular-nums">{new Date(t.timestamp).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-[#F8FAFC] font-semibold">{t.symbol}</td>
                        <td className={`px-4 py-2.5 font-bold ${t.side === "BUY" ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{t.side}</td>
                        <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{t.quantity}</td>
                        <td className="px-4 py-2.5 text-[#F8FAFC] tabular-nums">{fmt(t.execution_price)}</td>
                        <td className={`px-4 py-2.5 tabular-nums font-semibold ${pnlColor(t.realized_pnl)}`}>{fmt(t.realized_pnl)}</td>
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
              <div className="text-xs text-[#64748B] mb-2">
                Simulated paper execution — no real capital risked.
              </div>

              {tradeError && (
                <div className="text-xs text-[#EF4444] border border-[#EF4444]/20 bg-[#EF4444]/10 px-3 py-2">
                  {tradeError}
                </div>
              )}
              {tradeSuccess && (
                <div className="text-xs text-[#22C55E] border border-[#22C55E]/20 bg-[#22C55E]/10 px-3 py-2">
                  {tradeSuccess}
                </div>
              )}

              {[
                { label: "Symbol", value: tradeSymbol, onChange: (v: string) => setTradeSymbol(v.toUpperCase()), placeholder: "e.g. RELIANCE.NS" },
                { label: "Quantity", value: tradeQty, onChange: setTradeQty, placeholder: "10" },
                { label: "Limit Price (Optional)", value: tradePrice, onChange: setTradePrice, placeholder: "Live market price" },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{label}</label>
                  <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] font-mono text-xs px-3 py-2 outline-none placeholder-[#64748B] transition-colors"
                  />
                </div>
              ))}

              <div className="flex gap-2">
                {(["BUY", "SELL"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setTradeSide(side)}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors border ${
                      tradeSide === side
                        ? side === "BUY"
                          ? "bg-[#22C55E] border-[#22C55E] text-black"
                          : "bg-[#EF4444] border-[#EF4444] text-white"
                        : "bg-[#10141D] border-[#1E2538] text-[#64748B] hover:text-[#F8FAFC]"
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>

              <button
                onClick={executeTrade}
                className="w-full py-2.5 text-xs font-semibold bg-[#1E90FF] hover:bg-[#1C86EE] text-white transition-colors"
              >
                Execute {tradeSide} Order
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-[#64748B]">Create or select a portfolio on the left.</span>
        </div>
      )}
    </div>
  );
}
