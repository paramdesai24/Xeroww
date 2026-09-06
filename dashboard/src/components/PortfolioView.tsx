// src/components/PortfolioView.tsx
// Simulated portfolio manager: live valuations, BUY/SELL orders, transaction history.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Portfolio, PortfolioSummary, Transaction } from "../types/platform";

function pnlColor(v: number | null): string {
  if (v === null) return "text-[#525252]";
  return v >= 0 ? "text-[#22c55e]" : "text-[#ff4d4d]";
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
    <div className="flex-1 flex items-center justify-center">
      <span className="text-[11px] text-[#333] tracking-widest animate-pulse">LOADING PORTFOLIOS...</span>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Portfolio sidebar */}
      <div className="w-52 shrink-0 border-r border-[#1E1E1E] flex flex-col">
        <div className="px-3 py-2 border-b border-[#1E1E1E]">
          <span className="text-[10px] tracking-widest text-[#525252] font-bold">PORTFOLIOS</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {portfolios.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPortfolio(p.id)}
              className={`px-3 py-2.5 border-b border-[#111] cursor-pointer ${
                active?.id === p.id ? "bg-[#0a1015] border-l-2 border-l-[#00E5FF]" : "hover:bg-[#0d0d0d]"
              }`}
            >
              <div className={`text-xs ${active?.id === p.id ? "text-[#FAFAFA]" : "text-[#666]"}`}>{p.name}</div>
              <div className="text-[10px] text-[#333]">
                {fmt(p.cash_balance)} CASH
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#1E1E1E] p-3">
          <div className="flex gap-1">
            <input
              value={newPortName}
              onChange={(e) => setNewPortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPortfolio()}
              placeholder="New portfolio"
              className="flex-1 bg-[#111] border border-[#222] text-[#FAFAFA] text-[10px] px-2 py-1.5 outline-none focus:border-[#00E5FF] placeholder-[#333]"
            />
            <button onClick={createPortfolio}
              className="text-[10px] px-2 bg-[#00E5FF] text-black font-bold">+</button>
          </div>
        </div>
      </div>

      {/* Main panel */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Summary bar */}
          <div className="px-4 py-2 border-b border-[#1E1E1E] grid grid-cols-4 gap-4">
            {[
              { label: "TOTAL VALUE", value: fmt(active.total_value), color: "text-[#FAFAFA]" },
              { label: "CASH", value: fmt(active.cash_balance), color: "text-[#FAFAFA]" },
              { label: "HOLDINGS", value: fmt(active.holdings_value), color: "text-[#FAFAFA]" },
              {
                label: "UNREALIZED P&L",
                value: `${fmt(active.total_unrealized_pnl)} (${active.total_unrealized_pnl_pct?.toFixed(2)}%)`,
                color: pnlColor(active.total_unrealized_pnl),
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-[10px] text-[#525252] tracking-widest">{label}</div>
                <div className={`text-xs font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tab strip */}
          <div className="flex border-b border-[#1E1E1E]">
            {(["holdings", "contributions", "transactions", "trade"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-[10px] tracking-widest font-bold border-r border-[#1E1E1E] transition-colors ${
                  tab === t ? "text-[#00E5FF] bg-[#0a1015]" : "text-[#333] hover:text-[#666]"
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
                <div className="p-4 text-[11px] text-[#333] tracking-wider">NO HOLDINGS · EXECUTE A BUY TRADE</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[#1E1E1E] text-[#525252] tracking-widest">
                      {["SYMBOL", "QTY", "AVG PRICE", "CURR PRICE", "VALUE", "P&L", "ALLOC"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.holdings.map((h) => (
                      <tr key={h.symbol} className="border-b border-[#111] hover:bg-[#0d0d0d]">
                        <td className="px-4 py-2 text-[#FAFAFA] font-bold">{h.symbol}</td>
                        <td className="px-4 py-2 text-[#FAFAFA]">{h.quantity}</td>
                        <td className="px-4 py-2 text-[#666]">{fmt(h.average_price)}</td>
                        <td className="px-4 py-2 text-[#FAFAFA]">{fmt(h.current_price)}</td>
                        <td className="px-4 py-2 text-[#FAFAFA]">{fmt(h.current_value)}</td>
                        <td className={`px-4 py-2 ${pnlColor(h.unrealized_pnl)}`}>
                          {fmt(h.unrealized_pnl)} ({h.unrealized_pnl_pct?.toFixed(1)}%)
                        </td>
                        <td className="px-4 py-2 text-[#525252]">{h.allocation_pct?.toFixed(1)}%</td>
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
                <div className="p-3 bg-[#000] border border-[#1E1E1E]">
                  <div className="text-[9px] text-[#525252] uppercase tracking-widest">LARGEST CONTRIBUTOR</div>
                  {contrib?.largest_contributor ? (
                    <div className="mt-1">
                      <span className="text-xs font-bold text-[#22C55E] mr-2">{contrib.largest_contributor.symbol}</span>
                      <span className="text-[11px] text-[#22C55E]">+{fmt(contrib.largest_contributor.pnl_contribution_inr)} ({contrib.largest_contributor.pnl_contribution_pct}%)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#333] mt-1">— None today</div>
                  )}
                </div>

                <div className="p-3 bg-[#000] border border-[#1E1E1E]">
                  <div className="text-[9px] text-[#525252] uppercase tracking-widest">LARGEST DETRACTOR</div>
                  {contrib?.largest_detractor ? (
                    <div className="mt-1">
                      <span className="text-xs font-bold text-[#EF4444] mr-2">{contrib.largest_detractor.symbol}</span>
                      <span className="text-[11px] text-[#EF4444]">{fmt(contrib.largest_detractor.pnl_contribution_inr)} ({contrib.largest_detractor.pnl_contribution_pct}%)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#333] mt-1">— None today</div>
                  )}
                </div>

                <div className="p-3 bg-[#000] border border-[#1E1E1E]">
                  <div className="text-[9px] text-[#525252] uppercase tracking-widest">DAY P&amp;L CONTRIBUTION</div>
                  <div className="mt-1">
                    <span className={`text-xs font-bold ${pnlColor(contrib?.day_pnl_inr ?? 0)}`}>
                      {fmt(contrib?.day_pnl_inr ?? 0)} ({contrib?.day_pnl_pct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[#1E1E1E] text-[#525252] tracking-widest">
                    {["SYMBOL", "QTY", "PRICE", "MOVE", "VALUE", "P&L CONTRIBUTION", "PORTFOLIO ALLOC"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contrib?.holdings.map((h) => (
                    <tr key={h.symbol} className="border-b border-[#111] hover:bg-[#0d0d0d]">
                      <td className="px-4 py-2 text-[#FAFAFA] font-bold">{h.symbol}</td>
                      <td className="px-4 py-2 text-[#FAFAFA]">{h.quantity}</td>
                      <td className="px-4 py-2 text-[#FAFAFA]">{fmt(h.current_price)}</td>
                      <td className={`px-4 py-2 ${pnlColor(h.price_change)}`}>
                        {h.price_change > 0 ? "+" : ""}{h.price_change.toFixed(2)} ({h.price_change_pct > 0 ? "+" : ""}{h.price_change_pct}%)
                      </td>
                      <td className="px-4 py-2 text-[#FAFAFA]">{fmt(h.current_value)}</td>
                      <td className={`px-4 py-2 font-bold ${pnlColor(h.pnl_contribution_inr)}`}>
                        {h.pnl_contribution_inr > 0 ? "+" : ""}{fmt(h.pnl_contribution_inr)} ({h.pnl_contribution_pct}%)
                      </td>
                      <td className="px-4 py-2 text-[#525252]">{h.allocation_pct}%</td>
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
                <div className="p-4 text-[11px] text-[#333] tracking-wider">NO TRANSACTIONS YET</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[#1E1E1E] text-[#525252] tracking-widest">
                      {["TIMESTAMP", "SYMBOL", "SIDE", "QTY", "PRICE", "REALIZED P&L"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id} className="border-b border-[#111] hover:bg-[#0d0d0d]">
                        <td className="px-4 py-2 text-[#525252]">{new Date(t.timestamp).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2 text-[#FAFAFA] font-bold">{t.symbol}</td>
                        <td className={`px-4 py-2 font-bold ${t.side === "BUY" ? "text-[#22c55e]" : "text-[#ff4d4d]"}`}>{t.side}</td>
                        <td className="px-4 py-2 text-[#FAFAFA]">{t.quantity}</td>
                        <td className="px-4 py-2 text-[#FAFAFA]">{fmt(t.execution_price)}</td>
                        <td className={`px-4 py-2 ${pnlColor(t.realized_pnl)}`}>{fmt(t.realized_pnl)}</td>
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
              <div className="text-[10px] tracking-widest text-[#525252] mb-2">
                PAPER TRADE — NO REAL MONEY
              </div>

              {tradeError && (
                <div className="text-[10px] text-[#ff4d4d] border border-[#3a1818] bg-[#1a0a0a] px-3 py-2">
                  {tradeError}
                </div>
              )}
              {tradeSuccess && (
                <div className="text-[10px] text-[#22c55e] border border-[#1a3a1a] bg-[#0a1a0a] px-3 py-2">
                  {tradeSuccess}
                </div>
              )}

              {[
                { label: "SYMBOL", value: tradeSymbol, onChange: (v: string) => setTradeSymbol(v.toUpperCase()), placeholder: "RELIANCE.NS" },
                { label: "QUANTITY", value: tradeQty, onChange: setTradeQty, placeholder: "10" },
                { label: "LIMIT PRICE (optional)", value: tradePrice, onChange: setTradePrice, placeholder: "Live market price" },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label}>
                  <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">{label}</label>
                  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                    className="w-full bg-[#111] border border-[#2a2a2a] text-[#FAFAFA] text-xs px-3 py-2 outline-none focus:border-[#00E5FF] placeholder-[#333]"
                  />
                </div>
              ))}

              <div className="flex gap-2">
                {(["BUY", "SELL"] as const).map((side) => (
                  <button key={side} onClick={() => setTradeSide(side)}
                    className={`flex-1 py-2 text-[10px] font-bold tracking-widest transition-colors ${
                      tradeSide === side
                        ? side === "BUY" ? "bg-[#22c55e] text-black" : "bg-[#ff4d4d] text-black"
                        : "bg-[#111] border border-[#2a2a2a] text-[#525252] hover:text-[#888]"
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>

              <button onClick={executeTrade}
                className="w-full py-2.5 text-[10px] font-bold tracking-widest bg-[#00E5FF] text-black hover:bg-[#00cfea] transition-colors">
                EXECUTE {tradeSide} ORDER
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-[#333] tracking-widest">CREATE OR SELECT A PORTFOLIO</span>
        </div>
      )}
    </div>
  );
}
