// src/components/JournalView.tsx
// Decision Journal: Institutional trade thesis logger and audit trail.
// Strict terminal aesthetic: dense tabular telemetry, pitch-black styling.

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
      className="flex-1 flex flex-col overflow-hidden bg-[#000] text-[#e0e0e0]"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* Top Telemetry Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1A1A1A] bg-[#050505] text-[11px] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[#555] tracking-widest">MODULE:</span>
            <span className="text-[#00E5FF] font-bold">DECISION_JOURNAL</span>
          </div>
          <span className="text-[#222]">|</span>
          <div className="flex items-center gap-2">
            <span className="text-[#555]">TOTAL_ENTRIES:</span>
            <span className="text-[#FFF] font-bold">{entries.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#555]">OPEN_THESES:</span>
            <span className="text-[#00E5FF] font-bold">{openCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#555]">CONCLUDED:</span>
            <span className="text-[#888] font-bold">{closedCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["ALL", "OPEN", "CLOSED", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              id={`filter-${s.toLowerCase()}`}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border transition-colors ${
                statusFilter === s
                  ? "border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/10 font-bold"
                  : "border-[#222] text-[#555] hover:text-[#888] bg-transparent"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            id="refresh-journal-btn"
            onClick={fetchEntries}
            className="px-2.5 py-0.5 text-[10px] tracking-wider text-[#888] hover:text-[#FFF] border border-[#222] hover:border-[#444] transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Main Grid: Entry Form (Left / Top) & Ledger (Right / Fill) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Log New Thesis Form */}
        <div className="w-full md:w-[340px] border-b md:border-b-0 md:border-r border-[#1A1A1A] bg-[#020202] p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[#1A1A1A]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
            <span className="text-[10px] tracking-[0.2em] font-bold text-[#888] uppercase">
              LOG TRADE THESIS
            </span>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {createError && (
              <div className="px-2.5 py-1.5 bg-[#FF0000]/10 border border-[#FF0000]/30 text-[#FF4D4D] text-[10px]">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[#555] mb-1">
                SYMBOL
              </label>
              <input
                id="journal-symbol-input"
                type="text"
                placeholder="RELIANCE.NS"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#222] focus:border-[#00E5FF] text-[11px] text-[#FFF] px-2.5 py-1.5 outline-none tracking-wider uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[#555] mb-1">
                ACTION INTENT
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(["BUY", "SELL", "WATCH"] as const).map((act) => (
                  <button
                    type="button"
                    key={act}
                    id={`action-${act.toLowerCase()}`}
                    onClick={() => setAction(act)}
                    className={`py-1 text-[10px] tracking-wider font-bold border transition-colors ${
                      action === act
                        ? act === "BUY"
                          ? "bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e]"
                          : act === "SELL"
                          ? "bg-[#ff4d4d]/15 border-[#ff4d4d] text-[#ff4d4d]"
                          : "bg-[#eab308]/15 border-[#eab308] text-[#eab308]"
                        : "border-[#1E1E1E] text-[#444] hover:text-[#777]"
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[#555] mb-1">
                RATIONALE / THESIS (MIN 10 CHARS)
              </label>
              <textarea
                id="journal-thesis-input"
                rows={4}
                placeholder="Breakout above 20-day EMA with expanding volume profile..."
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#222] focus:border-[#00E5FF] text-[11px] text-[#DDD] p-2 outline-none font-mono resize-none leading-relaxed"
              />
            </div>

            <button
              id="submit-journal-entry-btn"
              type="submit"
              disabled={creating}
              className="w-full mt-1 py-2 bg-[#00E5FF] hover:bg-[#33EAFF] disabled:opacity-50 text-[#000] font-bold text-[10px] tracking-[0.2em] uppercase transition-colors"
            >
              {creating ? "COMMITTING..." : "COMMIT TO AUDIT TRAIL"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#151515] text-[9px] text-[#444] space-y-1">
            <div className="text-[#555] font-bold tracking-wider">TENANT ASSURANCE:</div>
            <p>Every logged thesis is cryptographically mapped to your user workspace and immutable across sessions.</p>
          </div>
        </div>

        {/* Right Column: Ledger / List */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#000]">
          {error && (
            <div className="p-3 bg-[#FF0000]/10 border-b border-[#FF0000]/30 text-[#FF4D4D] text-[11px]">
              {error}
            </div>
          )}

          {loading && entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[#444] text-[11px] tracking-widest">
              QUERYING DECISION AUDIT TRAIL...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#333] text-[11px] tracking-wider gap-2">
              <span>NO DECISION RECORDS FOUND</span>
              <span className="text-[9px] text-[#222]">
                Log a trade thesis on the left to initialize your audit record.
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-[#111]">
              {filteredEntries.map((entry) => {
                const isBuy = entry.action === "BUY";
                const isSell = entry.action === "SELL";
                const isOpen = entry.status === "OPEN";

                return (
                  <div
                    key={entry.id}
                    id={`journal-row-${entry.id}`}
                    className="p-4 hover:bg-[#050505] transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-bold text-[#FFF] tracking-wider font-mono">
                          {entry.symbol}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                            isBuy
                              ? "border-[#22c55e]/40 text-[#22c55e] bg-[#22c55e]/10"
                              : isSell
                              ? "border-[#ff4d4d]/40 text-[#ff4d4d] bg-[#ff4d4d]/10"
                              : "border-[#eab308]/40 text-[#eab308] bg-[#eab308]/10"
                          }`}
                        >
                          {entry.action}
                        </span>
                        <span
                          className={`text-[9px] tracking-wider font-semibold ${
                            isOpen
                              ? "text-[#00E5FF]"
                              : entry.status === "CLOSED"
                              ? "text-[#555]"
                              : "text-[#444] line-through"
                          }`}
                        >
                          [{entry.status}]
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-[#444]">
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
                          className="text-[9px] px-2 py-0.5 border border-[#00E5FF]/30 hover:border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/5 transition-colors"
                        >
                          {activeReviewId === entry.id ? "HIDE AUDIT" : "THESIS REVIEW"}
                        </button>
                        {isOpen && (
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`close-entry-${entry.id}`}
                              onClick={() => handleUpdateStatus(entry.id, "CLOSED")}
                              className="text-[9px] px-2 py-0.5 border border-[#222] hover:border-[#22c55e] text-[#666] hover:text-[#22c55e] transition-colors"
                            >
                              CLOSE
                            </button>
                            <button
                              id={`cancel-entry-${entry.id}`}
                              onClick={() => handleUpdateStatus(entry.id, "CANCELLED")}
                              className="text-[9px] px-2 py-0.5 border border-[#222] hover:border-[#ff4d4d] text-[#666] hover:text-[#ff4d4d] transition-colors"
                            >
                              CANCEL
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#BBB] leading-relaxed pl-1 border-l-2 border-[#222]">
                      {entry.thesis}
                    </p>

                    {/* Thesis Review Audit Box */}
                    {activeReviewId === entry.id && reviewData && (
                      <div className="mt-2 p-3 bg-[#020202] border border-[#00E5FF]/20 space-y-2 text-[10px]">
                        <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-1">
                          <span className="text-[#00E5FF] font-bold uppercase tracking-widest">
                            DETERMINISTIC THESIS OUTCOME AUDIT
                          </span>
                          <span className="text-[#888]">
                            Price Move: {reviewData.price_delta > 0 ? "+" : ""}{reviewData.price_delta} ({reviewData.price_delta_pct > 0 ? "+" : ""}{reviewData.price_delta_pct}%)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[#777] font-bold block mb-1">INITIAL CONTEXT:</span>
                            <ul className="list-disc list-inside text-[#AAA] space-y-0.5">
                              {reviewData.initial_context?.map((c: string, idx: number) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[#777] font-bold block mb-1">SUBSEQUENT OBSERVATION:</span>
                            <ul className="list-disc list-inside text-[#AAA] space-y-0.5">
                              {reviewData.later_observation?.map((o: string, idx: number) => (
                                <li key={idx}>{o}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}


                    {entry.context_snapshot && Object.keys(entry.context_snapshot).length > 0 && (
                      <div className="text-[9px] text-[#333] font-mono mt-1">
                        SNAPSHOT: {JSON.stringify(entry.context_snapshot)}
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
