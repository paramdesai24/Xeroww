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
      className="themed-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-none p-4 select-none"
    >
      <div className="bg-[#000000] border border-[#1E2538] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0B0E14] border-b border-[#1E2538] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-[#3B82F6]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">
              "What Changed?" Event Diff
            </span>
            <span className="text-[#334155]">·</span>
            <span className="text-xs text-[#1E90FF] font-mono font-semibold">{symbol}</span>
          </div>

          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] p-1 border border-transparent hover:border-[#1E2538] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[#64748B]">
              Evaluating deterministic interval diffs…
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-[#EF4444]">
              Failed to retrieve event diff for {symbol}
            </div>
          ) : (
            <>
              {/* Diff Summary Bar */}
              <div className="p-3 bg-[#0B0E14] border border-[#1E2538] flex items-center justify-between">
                <div>
                  <div className="text-label text-[#64748B]">Interval</div>
                  <div className="text-xs font-mono font-semibold text-[#F8FAFC] mt-0.5">
                    {data.from_time} → {data.to_time}
                  </div>
                </div>
                <div>
                  <div className="text-label text-[#64748B]">Price Movement</div>
                  <div
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      data.price_delta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    {data.price_delta > 0 ? "+" : ""}
                    {data.price_delta.toFixed(2)} ({data.price_delta_pct > 0 ? "+" : ""}
                    {data.price_delta_pct.toFixed(2)}%)
                  </div>
                </div>
                <div>
                  <div className="text-label text-[#64748B]">Observed Events</div>
                  <div className="text-sm font-bold font-mono text-[#1E90FF] tabular-nums mt-0.5">
                    {data.event_count}
                  </div>
                </div>
              </div>

              {/* Factual Narrative Timeline */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#94A3B8]">
                  Coincident Structural Events (Non-Causal)
                </div>
                <div className="space-y-1.5">
                  {data.events.map((ev, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-[#0B0E14] border border-[#1E2538] flex items-start gap-2 text-label"
                    >
                      <Activity size={14} className="text-[#3B82F6] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-semibold text-[#1E90FF] mr-1.5">[{ev.category}]</span>
                        <span className="text-[#F8FAFC]">{ev.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Factual Narrative Summary */}
              <div className="p-3 bg-[#05070B] border border-[#1E2538] space-y-1.5">
                <div className="text-xs font-semibold text-[#94A3B8]">
                  Factual Narrative
                </div>
                {data.factual_narrative.map((n, i) => (
                  <p key={i} className="text-xs text-[#94A3B8] leading-relaxed">
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
