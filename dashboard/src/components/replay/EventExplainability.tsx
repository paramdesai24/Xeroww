// src/components/replay/EventExplainability.tsx
// Institutional Explainability Engine telemetry panel.
// Zero fuzzy logic — confidence derived deterministically from mathematical rule coverage.

import { ShieldCheck, CheckCircle2, ListChecks, Activity } from "lucide-react";
import type { ExplainabilityPayload } from "../../types/events";

interface EventExplainabilityProps {
  explainability: ExplainabilityPayload;
  title?: string;
  timestamp?: string;
}

export function EventExplainability({
  explainability,
  title,
  timestamp,
}: EventExplainabilityProps) {
  const confPct = Math.round(explainability.confidence * 100);

  // Confidence color scale
  const confColor =
    confPct >= 80
      ? "text-[#22C55E] bg-[#22C55E]"
      : confPct >= 65
      ? "text-[#3B82F6] bg-[#3B82F6]"
      : "text-[#F59E0B] bg-[#F59E0B]";

  return (
    <div className="bg-[#05070B] border border-[#1E2538] p-3 space-y-3 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E2538] pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-sm bg-[#1E90FF]/15 border border-[#1E90FF]/35 flex items-center justify-center text-[#1E90FF] shrink-0">
            <ShieldCheck size={12} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#F8FAFC] truncate whitespace-nowrap">
              {title ?? "DETERMINISTIC EXPLAINABILITY AUDIT"}
            </div>
            {timestamp && (
              <div className="text-[10px] text-[#64748B] whitespace-nowrap">{timestamp}</div>
            )}
          </div>
        </div>

        <div className="text-[10px] px-1.5 py-0.5 bg-[#10141D] border border-[#1E2538] text-[#94A3B8] rounded-sm shrink-0 whitespace-nowrap">
          Deterministic
        </div>
      </div>

      {/* Signal and Confidence Meter */}
      <div className="space-y-1.5 bg-[#0B0E14] border border-[#1E2538] p-2.5 rounded-sm">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#64748B] flex items-center gap-1">
            <Activity size={12} className="text-[#1E90FF]" />
            <span>Signal Identifier</span>
          </span>
          <span className="text-[#1E90FF] font-semibold truncate ml-2">
            {explainability.signal}
          </span>
        </div>

        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#64748B]">Rule Coverage Confidence</span>
            <span className="font-bold text-[#F8FAFC]">{confPct}%</span>
          </div>

          <div className="h-1.5 w-full bg-[#10141D] rounded-none overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 ${confColor}`}
              style={{ width: `${confPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Triggered Rules Checklist */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-[#64748B]">
          <ListChecks size={12} className="text-[#3B82F6]" />
          <span>Triggered Mathematical Rules ({explainability.triggeredRules.length})</span>
        </div>

        <div className="space-y-1">
          {explainability.triggeredRules.map((rule, idx) => (
            <div
              key={idx}
              className="px-2 py-1 bg-[#0B0E14] border border-[#1E2538] flex items-center gap-2 text-[10px] text-[#CBD5E1]"
            >
              <CheckCircle2 size={11} className="text-[#22C55E] shrink-0" />
              <span className="truncate whitespace-nowrap flex-1" title={rule}>
                {rule}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Empirical Evidence */}
      {explainability.evidence.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-[#1E2538]">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">
            Point-in-Time Evidence
          </div>
          <div className="flex flex-wrap gap-1.5">
            {explainability.evidence.map((ev, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-[#10141D] border border-[#1E2538] text-[10px] text-[#94A3B8] rounded-sm whitespace-nowrap"
              >
                {ev}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
