// src/components/xray/XRayPatternEngine.tsx
// Section 2: Deterministic Pattern Engine display.
// Primary pattern, deterministic confidence meter, mathematical classification rationale, and conditions checklist.

import { ShieldCheck, Check, X, Compass, Target } from "lucide-react";
import type { XRayPatternEngineResult } from "../../types/xray";

interface XRayPatternEngineProps {
  pattern: XRayPatternEngineResult;
}

export function XRayPatternEngine({ pattern }: XRayPatternEngineProps) {
  const { patternName, direction, category, confidenceScore, confidencePct, rationale, stopLossReference, conditions } = pattern;

  const isBullish = direction === "bullish";
  const isBearish = direction === "bearish";

  return (
    <div className="bg-[#0D0D0D] border border-[#232323] p-4 flex flex-col gap-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]" style={{ fontFamily: "var(--font-mono)" }}>
            2. Pattern Engine Display
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#6B6B72] border border-[#232323] px-2 py-0.5 rounded-sm">
          DETERMINISTIC V2
        </span>
      </div>

      {/* Primary Detected Pattern Banner */}
      <div
        className={`p-3 border rounded-sm flex items-center justify-between ${
          isBullish
            ? "bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.3)]"
            : isBearish
            ? "bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.3)]"
            : "bg-[#161616] border-[#333333]"
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold tracking-tight ${
                isBullish ? "text-[#22C55E]" : isBearish ? "text-[#EF4444]" : "text-[#FAFAFA]"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {patternName}
            </span>
            <span
              className={`text-[10px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded-[2px] ${
                isBullish ? "bg-[#22C55E]/20 text-[#22C55E]" : isBearish ? "bg-[#EF4444]/20 text-[#EF4444]" : "bg-[#6B6B72]/20 text-[#A0A0A8]"
              }`}
            >
              {category}
            </span>
          </div>
          <span className="text-[11px] text-[#A0A0A8]">
            Directional Bias:{" "}
            <strong className={isBullish ? "text-[#22C55E]" : isBearish ? "text-[#EF4444]" : "text-[#FAFAFA]"}>
              {direction.toUpperCase()}
            </strong>
          </span>
        </div>

        {/* Deterministic Confidence Score Gauge */}
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold font-mono text-[#FAFAFA] tabular-nums">
              {confidencePct}%
            </span>
            <span className="text-[10px] text-[#A0A0A8] font-mono">CONF</span>
          </div>
          <span className="text-[9px] font-mono text-[#1E90FF]">Formulaic Fit</span>
        </div>
      </div>

      {/* Confidence Meter Bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] font-mono text-[#6B6B72]">
          <span>Pattern Confidence (Deterministic, Non-AI)</span>
          <span className="text-[#A0A0A8]">{confidenceScore.toFixed(3)} Score</span>
        </div>
        <div className="w-full h-1.5 bg-[#161616] rounded-sm overflow-hidden">
          <div
            style={{ width: `${confidencePct}%` }}
            className={`h-full transition-all duration-300 ${
              confidencePct >= 90 ? "bg-[#22C55E]" : confidencePct >= 75 ? "bg-[#1E90FF]" : "bg-[#A0A0A8]"
            }`}
          />
        </div>
      </div>

      {/* Why It Was Classified (Deterministic Narrative) */}
      <div className="bg-[#05070B] border border-[#1A1A1A] p-2.5 rounded-sm flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] text-[#6B6B72] font-mono uppercase">
          <Compass size={12} className="text-[#1E90FF]" />
          <span>Classification Rationale</span>
        </div>
        <p className="text-xs text-[#A0A0A8] leading-relaxed m-0 font-sans">
          {rationale}
        </p>
      </div>

      {/* Mathematical Conditions Satisfied Checklist */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#6B6B72]">
          <span>Mathematical Conditions Verified</span>
          <span className="text-[#22C55E]">
            {conditions.filter((c) => c.satisfied).length} of {conditions.length} Satisfied
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {conditions.map((cond) => (
            <div
              key={cond.id}
              className={`px-2.5 py-1.5 border rounded-sm flex items-center justify-between text-xs font-mono transition-colors ${
                cond.satisfied
                  ? "bg-[#080808] border-[#1A1A1A] text-[#FAFAFA]"
                  : "bg-[rgba(239,68,68,0.05)] border-[rgba(239,68,68,0.25)] text-[#A0A0A8]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    cond.satisfied
                      ? "bg-[rgba(34,197,94,0.15)] text-[#22C55E]"
                      : "bg-[rgba(239,68,68,0.15)] text-[#EF4444]"
                  }`}
                >
                  {cond.satisfied ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[#FAFAFA]">{cond.label}</span>
                  <span className="text-[10px] text-[#6B6B72]">{cond.expression}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold tabular-nums text-[#FAFAFA]">
                  {cond.actual}
                  {cond.unit !== "₹" && cond.unit !== "x" ? cond.unit : ""}
                </span>
                <span
                  className={`block text-[9px] font-semibold uppercase ${
                    cond.satisfied ? "text-[#22C55E]" : "text-[#EF4444]"
                  }`}
                >
                  {cond.satisfied ? "PASSED" : "FAILED"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stop Loss Reference Print */}
      {stopLossReference !== null && (
        <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1.5 bg-[#05070B] border border-[#1A1A1A]">
          <span className="flex items-center gap-1.5 text-[#6B6B72]">
            <Target size={12} className="text-[#1E90FF]" />
            <span>Mathematical Stop Reference:</span>
          </span>
          <span className="font-bold text-[#FAFAFA] tabular-nums">₹{stopLossReference.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
