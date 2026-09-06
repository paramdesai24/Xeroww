// src/components/SignalAlignmentCard.tsx
// Deterministic Signal Alignment confluence card — pitch-black terminal styling.

import { useState } from "react";
import type { SignalAlignmentResponse } from "../types/structure";

interface Props {
  alignment: SignalAlignmentResponse | null;
  loading?: boolean;
}

export default function SignalAlignmentCard({ alignment, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !alignment) {
    return (
      <div className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] text-[10px] text-[#444] tracking-widest font-mono">
        EVALUATING SIGNAL ALIGNMENT...
      </div>
    );
  }

  if (!alignment) return null;

  const isBullish = alignment.dominant_bias === "BULLISH_CONFLUENCE";
  const isBearish = alignment.dominant_bias === "BEARISH_CONFLUENCE";

  const biasBadgeStyle = isBullish
    ? "border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10"
    : isBearish
    ? "border-[#EF4444]/40 text-[#EF4444] bg-[#EF4444]/10"
    : "border-[#52525B] text-[#A1A1AA] bg-[#27272A]/20";

  return (
    <div
      id="signal-alignment-card"
      className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] flex flex-col gap-2.5 font-mono select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#888] tracking-widest uppercase">
            SIGNAL CONFLUENCE
          </span>
          <span className="text-[#333] text-[10px]">·</span>
          <span className="text-[9px] text-[#555] tracking-wider uppercase">
            RULE TALLY
          </span>
        </div>
        <span
          id="signal-bias-badge"
          className={`text-[9px] font-bold px-2 py-0.5 border tracking-wider uppercase ${biasBadgeStyle}`}
        >
          {alignment.dominant_bias.replace("_", " ")}
        </span>
      </div>

      {/* Alignment Tally Bar */}
      <div className="grid grid-cols-2 gap-2 bg-[#050505] p-2 border border-[#151515]">
        <div className="flex flex-col">
          <span className="text-[9px] text-[#555] tracking-wider uppercase">
            BULLISH CONFLUENCE
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-[15px] font-bold text-[#22C55E]">
              {alignment.bullish_alignment_count}
            </span>
            <span className="text-[#555] text-[10px]">/ {alignment.alignment_total}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] text-[#555] tracking-wider uppercase">
            BEARISH CONFLUENCE
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-[15px] font-bold text-[#EF4444]">
              {alignment.bearish_alignment_count}
            </span>
            <span className="text-[#555] text-[10px]">/ {alignment.alignment_total}</span>
          </div>
        </div>
      </div>

      {/* Summary Note */}
      <div className="text-[10px] text-[#888] leading-relaxed">
        {alignment.factual_summary}
      </div>

      {/* Toggle Conditions Checklist */}
      <div className="pt-1 border-t border-[#151515]">
        <button
          id="toggle-conditions-btn"
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-[#00E5FF] hover:text-[#33EAFF] font-semibold tracking-wider uppercase flex items-center justify-between w-full"
        >
          <span>{expanded ? "▲ HIDE CONDITIONS" : "▼ INSPECT 12 CONDITIONS"}</span>
          <span className="text-[#444] text-[8px]">DETERMINISTIC RULES</span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {alignment.conditions.map((c) => (
              <div
                key={c.condition_id}
                className="flex items-start gap-1.5 p-1.5 bg-[#050505] border border-[#151515] text-[9px]"
              >
                <span
                  className={`px-1 rounded-sm text-[8px] font-bold shrink-0 ${
                    c.satisfied
                      ? c.bias === "bullish"
                        ? "bg-[#22C55E]/20 text-[#22C55E]"
                        : "bg-[#EF4444]/20 text-[#EF4444]"
                      : "bg-[#27272A] text-[#52525B]"
                  }`}
                >
                  {c.satisfied ? "YES" : "NO"}
                </span>
                <div className="flex flex-col flex-1">
                  <span
                    className={`font-semibold ${
                      c.satisfied ? "text-[#DDD]" : "text-[#555]"
                    }`}
                  >
                    {c.label} ({c.bias})
                  </span>
                  <span className="text-[#666] text-[8.5px] leading-tight">
                    {c.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
