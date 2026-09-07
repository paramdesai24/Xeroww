// src/components/EventDiffModal.tsx
// Deterministic Event-Diff Inspector ("What Changed?").
// Compares sessions and structures without causal claims.

import { useEffect, useState } from "react";
import { X, GitCompare, Activity } from "lucide-react";
import { api } from "../api/client";
import type { EventDiffResponse } from "../types/structure";

interface Props {
  symbol: string;
  onClose: () => void;
}

export default function EventDiffModal({ symbol, onClose }: Props) {
  const [data, setData] = useState<EventDiffResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.eventDiff
      .getLatest(symbol)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol]);

  return (
    <div
      id="event-diff-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-base)]/80 backdrop-blur-[2px] p-4 select-none font-mono"
    >
      <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-[var(--accent)]" />
            <span className="text-xs font-bold tracking-widest text-[var(--text-primary)] uppercase">
              "WHAT CHANGED?" EVENT DIFF
            </span>
            <span className="text-[#404040]">·</span>
            <span className="text-xs text-[var(--accent)] font-semibold">{symbol}</span>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 border border-transparent hover:border-[var(--border-subtle)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[var(--text-tertiary)]">
              EVALUATING DETERMINISTIC INTERVAL DIFFS…
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-[var(--negative)]">
              FAILED TO RETRIEVE EVENT DIFF FOR {symbol}
            </div>
          ) : (
            <>
              {/* Diff Summary Bar */}
              <div className="p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">INTERVAL</div>
                  <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">
                    {data.from_time} → {data.to_time}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">PRICE MOVEMENT</div>
                  <div
                    className={`text-sm font-bold tabular-nums mt-0.5 ${
                      data.price_delta >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
                    }`}
                  >
                    {data.price_delta > 0 ? "+" : ""}
                    {data.price_delta.toFixed(2)} ({data.price_delta_pct > 0 ? "+" : ""}
                    {data.price_delta_pct.toFixed(2)}%)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">OBSERVED EVENTS</div>
                  <div className="text-sm font-bold text-[var(--accent)] tabular-nums mt-0.5">
                    {data.event_count}
                  </div>
                </div>
              </div>

              {/* Factual Narrative Timeline */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest uppercase">
                  COINCIDENT STRUCTURAL EVENTS (NON-CAUSAL)
                </div>
                <div className="space-y-1.5">
                  {data.events.map((ev, i) => (
                    <div
                      key={i}
                      className="p-2 bg-[var(--surface-base)] border border-[var(--border-subtle)] flex items-start gap-2 text-[11px]"
                    >
                      <Activity size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold text-[var(--text-secondary)] mr-1.5">[{ev.category}]</span>
                        <span className="text-[var(--text-primary)]">{ev.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Factual Narrative Summary */}
              <div className="p-3 bg-[var(--surface-inset)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[10px] font-bold text-[var(--text-secondary)] tracking-widest uppercase">
                  FACTUAL NARRATIVE
                </div>
                {data.factual_narrative.map((n, i) => (
                  <p key={i} className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {n}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
