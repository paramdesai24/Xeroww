// src/components/JournalView.tsx
// Decision Journal: Institutional trade thesis logger and audit trail.
// Graphite-and-paper design system.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { JournalEntry } from "../types/platform";

export default function JournalView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED" | "CANCELLED">("ALL");

  // New entry form state
  const [symbol, setSymbol] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL" | "WATCH">("BUY");
  const [thesis, setThesis] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeReviewId, setActiveReviewId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.journal.list();
      setEntries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) {
      setCreateError("Symbol is required");
      return;
    }
    if (thesis.trim().length < 10) {
      setCreateError("Thesis must be at least 10 characters");
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      await api.journal.create(symbol.trim().toUpperCase(), action, thesis.trim(), {
        timestamp: new Date().toISOString(),
        client: "xeroww-terminal-v0.6",
      });
      setSymbol("");
      setThesis("");
      await fetchEntries();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create entry");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: "OPEN" | "CLOSED" | "CANCELLED") => {
    try {
      await api.journal.updateStatus(id, newStatus);
      setEntries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (statusFilter === "ALL") return true;
    return e.status === statusFilter;
  });

  const openCount = entries.filter((e) => e.status === "OPEN").length;
  const closedCount = entries.filter((e) => e.status === "CLOSED").length;

  return (
    <div
      id="journal-module"
      className="flex-1 flex flex-col overflow-hidden bg-[#000000] text-[#F8FAFC]"
    >
      {/* Top Telemetry Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2538] bg-[#05070B] text-xs shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Module:</span>
            <span className="text-[#F59E0B] font-semibold">Decision Journal</span>
          </div>
          <span className="text-[#334155]">|</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#64748B]">Total:</span>
            <span className="text-[#F8FAFC] font-bold tabular-nums">{entries.length}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#64748B]">Open:</span>
            <span className="text-[#F59E0B] font-bold tabular-nums">{openCount}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#64748B]">Concluded:</span>
            <span className="text-[#94A3B8] font-bold tabular-nums">{closedCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["ALL", "OPEN", "CLOSED", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              id={`filter-${s.toLowerCase()}`}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "border-[#F59E0B] text-[#F59E0B] bg-[#F59E0B]/10 font-semibold"
                  : "border-[#1E2538] text-[#64748B] hover:text-[#94A3B8] bg-transparent"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
          <button
            id="refresh-journal-btn"
            onClick={fetchEntries}
            className="px-3 py-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E2538] hover:border-[#3B82F6] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Grid: Entry Form (Left / Top) & Ledger (Right / Fill) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Log New Thesis Form */}
        <div className="w-full md:w-[340px] border-b md:border-b-0 md:border-r border-[#1E2538] bg-[#05070B] p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[#1E2538]">
            <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="text-xs font-semibold text-[#F8FAFC]">
              Log Trade Thesis
            </span>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {createError && (
              <div className="px-3 py-2 bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Symbol
              </label>
              <input
                id="journal-symbol-input"
                type="text"
                placeholder="e.g. RELIANCE.NS"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-xs text-[#F8FAFC] px-3 py-2 outline-none font-mono uppercase placeholder-[#64748B] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Action Intent
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["BUY", "SELL", "WATCH"] as const).map((act) => (
                  <button
                    type="button"
                    key={act}
                    id={`action-${act.toLowerCase()}`}
                    onClick={() => setAction(act)}
                    className={`py-1.5 text-xs font-semibold border transition-colors ${
                      action === act
                        ? act === "BUY"
                          ? "bg-[#22C55E] border-[#22C55E] text-black"
                          : act === "SELL"
                          ? "bg-[#EF4444] border-[#EF4444] text-white"
                          : "bg-[#F59E0B] border-[#F59E0B] text-black"
                        : "border-[#1E2538] bg-[#10141D] text-[#64748B] hover:text-[#94A3B8]"
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Rationale / Thesis (min 10 chars)
              </label>
              <textarea
                id="journal-thesis-input"
                rows={4}
                placeholder="e.g. Breakout above 20-day EMA with expanding volume profile and favorable risk-to-reward…"
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-xs text-[#F8FAFC] p-2.5 outline-none resize-none leading-relaxed placeholder-[#64748B] transition-colors"
              />
            </div>

            <button
              id="submit-journal-entry-btn"
              type="submit"
              disabled={creating}
              className="w-full mt-1 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold text-xs transition-colors disabled:opacity-50"
            >
              {creating ? "Committing…" : "Commit to Audit Trail"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#1E2538] text-[11px] text-[#64748B] space-y-1">
            <div className="text-[#94A3B8] font-semibold">Tenant Assurance:</div>
            <p>Every logged thesis is cryptographically mapped to your user workspace and immutable across sessions.</p>
          </div>
        </div>

        {/* Right Column: Ledger / List */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
          {error && (
            <div className="p-3 bg-[#EF4444]/10 border-b border-[#EF4444]/20 text-[#EF4444] text-xs">
              {error}
            </div>
          )}

          {loading && entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[#64748B] text-xs">
              Querying decision audit trail…
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#64748B] text-xs gap-1">
              <span className="font-semibold text-[#94A3B8]">No decision records found</span>
              <span className="text-[11px] text-[#64748B]">
                Log a trade thesis on the left to initialize your audit record.
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-[#1E2538]/60">
              {filteredEntries.map((entry) => {
                const isBuy = entry.action === "BUY";
                const isSell = entry.action === "SELL";
                const isOpen = entry.status === "OPEN";

                return (
                  <div
                    key={entry.id}
                    id={`journal-row-${entry.id}`}
                    className="p-4 hover:bg-[#0B0E14] transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#F8FAFC] font-mono">
                          {entry.symbol}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 border ${
                            isBuy
                              ? "border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10"
                              : isSell
                              ? "border-[#EF4444]/40 text-[#EF4444] bg-[#EF4444]/10"
                              : "border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10"
                          }`}
                        >
                          {entry.action}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold ${
                            isOpen
                              ? "text-[#F59E0B]"
                              : entry.status === "CLOSED"
                              ? "text-[#64748B]"
                              : "text-[#64748B] line-through"
                          }`}
                        >
                          [{entry.status}]
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#64748B] font-mono tabular-nums">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        <button
                          id={`review-entry-${entry.id}`}
                          onClick={async () => {
                            if (activeReviewId === entry.id) {
                              setActiveReviewId(null);
                              setReviewData(null);
                            } else {
                              setActiveReviewId(entry.id);
                              try {
                                const rev = await api.journal.review(entry.id);
                                setReviewData(rev);
                              } catch {
                                setReviewData(null);
                              }
                            }
                          }}
                          className="text-xs px-2.5 py-1 border border-[#1E2538] hover:border-[#3B82F6] text-[#94A3B8] hover:text-[#F8FAFC] bg-[#10141D] transition-colors"
                        >
                          {activeReviewId === entry.id ? "Hide Audit" : "Thesis Review"}
                        </button>
                        {isOpen && (
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`close-entry-${entry.id}`}
                              onClick={() => handleUpdateStatus(entry.id, "CLOSED")}
                              className="text-xs px-2 py-1 border border-[#1E2538] hover:border-[#22C55E] text-[#64748B] hover:text-[#22C55E] transition-colors"
                            >
                              Close
                            </button>
                            <button
                              id={`cancel-entry-${entry.id}`}
                              onClick={() => handleUpdateStatus(entry.id, "CANCELLED")}
                              className="text-xs px-2 py-1 border border-[#1E2538] hover:border-[#EF4444] text-[#64748B] hover:text-[#EF4444] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#94A3B8] leading-relaxed pl-3 border-l-2 border-[#1E2538]">
                      {entry.thesis}
                    </p>

                    {/* Thesis Review Audit Box */}
                    {activeReviewId === entry.id && reviewData && (
                      <div className="mt-2 p-3 bg-[#0B0E14] border border-[#1E2538] space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-[#1E2538] pb-1.5">
                          <span className="text-[#3B82F6] font-semibold">
                            Deterministic Thesis Outcome Audit
                          </span>
                          <span className="text-[#F8FAFC] font-mono tabular-nums">
                            Price Move: {reviewData.price_delta > 0 ? "+" : ""}{reviewData.price_delta} ({reviewData.price_delta_pct > 0 ? "+" : ""}{reviewData.price_delta_pct}%)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[#64748B] font-semibold block mb-1">Initial Context:</span>
                            <ul className="list-disc list-inside text-[#94A3B8] space-y-0.5">
                              {reviewData.initial_context?.map((c: string, idx: number) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[#64748B] font-semibold block mb-1">Subsequent Observation:</span>
                            <ul className="list-disc list-inside text-[#94A3B8] space-y-0.5">
                              {reviewData.later_observation?.map((o: string, idx: number) => (
                                <li key={idx}>{o}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {entry.context_snapshot && Object.keys(entry.context_snapshot).length > 0 && (
                      <div className="text-[11px] text-[#64748B] font-mono mt-1">
                        Snapshot: {JSON.stringify(entry.context_snapshot)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
