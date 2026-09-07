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
      className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)] font-mono"
    >
      {/* Top Telemetry Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[11px] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-tertiary)] tracking-widest">MODULE:</span>
            <span className="text-[var(--accent)] font-bold">DECISION_JOURNAL</span>
          </div>
          <span className="text-[var(--border-default)]">|</span>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)]">TOTAL_ENTRIES:</span>
            <span className="text-[var(--text-primary)] font-bold tabular-nums">{entries.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)]">OPEN_THESES:</span>
            <span className="text-[var(--accent)] font-bold tabular-nums">{openCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)]">CONCLUDED:</span>
            <span className="text-[var(--text-secondary)] font-bold tabular-nums">{closedCount}</span>
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
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-subtle)] font-bold"
                  : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            id="refresh-journal-btn"
            onClick={fetchEntries}
            className="px-2.5 py-0.5 text-[10px] tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Main Grid: Entry Form (Left / Top) & Ledger (Right / Fill) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Log New Thesis Form */}
        <div className="w-full md:w-[340px] border-b md:border-b-0 md:border-r border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[var(--border-subtle)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            <span className="text-[10px] tracking-[0.2em] font-bold text-[var(--text-secondary)] uppercase">
              LOG TRADE THESIS
            </span>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {createError && (
              <div className="px-2.5 py-1.5 bg-[var(--negative-subtle)] border border-[var(--negative)]/20 text-[var(--negative)] text-[10px]">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
                SYMBOL
              </label>
              <input
                id="journal-symbol-input"
                type="text"
                placeholder="RELIANCE.NS"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[var(--surface-overlay)] border border-[var(--border-default)] focus:border-[var(--border-strong)] text-[11px] text-[var(--text-primary)] px-2.5 py-1.5 outline-none tracking-wider uppercase font-mono placeholder-[var(--text-tertiary)]"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
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
                          ? "bg-[var(--positive-subtle)] border-[var(--positive)]/40 text-[var(--positive)]"
                          : act === "SELL"
                          ? "bg-[var(--negative-subtle)] border-[var(--negative)]/40 text-[var(--negative)]"
                          : "bg-[var(--warning-subtle)] border-[var(--warning)]/40 text-[var(--warning)]"
                        : "border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
                RATIONALE / THESIS (MIN 10 CHARS)
              </label>
              <textarea
                id="journal-thesis-input"
                rows={4}
                placeholder="Breakout above 20-day EMA with expanding volume profile…"
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="w-full bg-[var(--surface-overlay)] border border-[var(--border-default)] focus:border-[var(--border-strong)] text-[11px] text-[var(--text-primary)] p-2 outline-none font-mono resize-none leading-relaxed placeholder-[var(--text-tertiary)]"
              />
            </div>

            <button
              id="submit-journal-entry-btn"
              type="submit"
              disabled={creating}
              className="w-full mt-1 py-2 bg-[var(--surface-overlay)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--text-primary)] hover:text-[var(--accent)] disabled:opacity-50 font-bold text-[10px] tracking-[0.2em] uppercase transition-colors"
            >
              {creating ? "COMMITTING…" : "COMMIT TO AUDIT TRAIL"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] text-[9px] text-[var(--text-tertiary)] space-y-1">
            <div className="text-[var(--text-secondary)] font-bold tracking-wider">TENANT ASSURANCE:</div>
            <p>Every logged thesis is cryptographically mapped to your user workspace and immutable across sessions.</p>
          </div>
        </div>

        {/* Right Column: Ledger / List */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-base)]">
          {error && (
            <div className="p-3 bg-[var(--negative-subtle)] border-b border-[var(--negative)]/20 text-[var(--negative)] text-[11px]">
              {error}
            </div>
          )}

          {loading && entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] text-[11px] tracking-widest">
              QUERYING DECISION AUDIT TRAIL…
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-tertiary)] text-[11px] tracking-wider gap-2">
              <span>NO DECISION RECORDS FOUND</span>
              <span className="text-[9px] text-[var(--text-tertiary)]">
                Log a trade thesis on the left to initialize your audit record.
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {filteredEntries.map((entry) => {
                const isBuy = entry.action === "BUY";
                const isSell = entry.action === "SELL";
                const isOpen = entry.status === "OPEN";

                return (
                  <div
                    key={entry.id}
                    id={`journal-row-${entry.id}`}
                    className="p-4 hover:bg-[var(--surface-raised)] transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-bold text-[var(--text-primary)] tracking-wider font-mono">
                          {entry.symbol}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                            isBuy
                              ? "border-[var(--positive)]/40 text-[var(--positive)] bg-[var(--positive-subtle)]"
                              : isSell
                              ? "border-[var(--negative)]/40 text-[var(--negative)] bg-[var(--negative-subtle)]"
                              : "border-[var(--warning)]/40 text-[var(--warning)] bg-[var(--warning-subtle)]"
                          }`}
                        >
                          {entry.action}
                        </span>
                        <span
                          className={`text-[9px] tracking-wider font-semibold ${
                            isOpen
                              ? "text-[var(--accent)]"
                              : entry.status === "CLOSED"
                              ? "text-[var(--text-tertiary)]"
                              : "text-[var(--text-tertiary)] line-through"
                          }`}
                        >
                          [{entry.status}]
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
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
                          className="text-[9px] px-2 py-0.5 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-raised)] transition-colors"
                        >
                          {activeReviewId === entry.id ? "HIDE AUDIT" : "THESIS REVIEW"}
                        </button>
                        {isOpen && (
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`close-entry-${entry.id}`}
                              onClick={() => handleUpdateStatus(entry.id, "CLOSED")}
                              className="text-[9px] px-2 py-0.5 border border-[var(--border-default)] hover:border-[var(--positive)] text-[var(--text-tertiary)] hover:text-[var(--positive)] transition-colors"
                            >
                              CLOSE
                            </button>
                            <button
                              id={`cancel-entry-${entry.id}`}
                              onClick={() => handleUpdateStatus(entry.id, "CANCELLED")}
                              className="text-[9px] px-2 py-0.5 border border-[var(--border-default)] hover:border-[var(--negative)] text-[var(--text-tertiary)] hover:text-[var(--negative)] transition-colors"
                            >
                              CANCEL
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed pl-2 border-l-2 border-[var(--border-subtle)]">
                      {entry.thesis}
                    </p>

                    {/* Thesis Review Audit Box */}
                    {activeReviewId === entry.id && reviewData && (
                      <div className="mt-2 p-3 bg-[var(--surface-overlay)] border border-[var(--border-subtle)] space-y-2 text-[10px]">
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1">
                          <span className="text-[var(--accent)] font-bold uppercase tracking-widest">
                            DETERMINISTIC THESIS OUTCOME AUDIT
                          </span>
                          <span className="text-[var(--text-secondary)] tabular-nums">
                            Price Move: {reviewData.price_delta > 0 ? "+" : ""}{reviewData.price_delta} ({reviewData.price_delta_pct > 0 ? "+" : ""}{reviewData.price_delta_pct}%)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[var(--text-tertiary)] font-bold block mb-1">INITIAL CONTEXT:</span>
                            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-0.5">
                              {reviewData.initial_context?.map((c: string, idx: number) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)] font-bold block mb-1">SUBSEQUENT OBSERVATION:</span>
                            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-0.5">
                              {reviewData.later_observation?.map((o: string, idx: number) => (
                                <li key={idx}>{o}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {entry.context_snapshot && Object.keys(entry.context_snapshot).length > 0 && (
                      <div className="text-[9px] text-[var(--text-tertiary)] font-mono mt-1">
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
