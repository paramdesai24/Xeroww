// src/components/PatternCard.tsx
// Right panel — Candlestick Pattern Analysis & Deterministic Contextual Interpretations.

import { ShieldCheck, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Layers } from "lucide-react";
import type { PatternData } from "../types/market";

interface PatternCardProps {
  pattern: PatternData | null;
}

export default function PatternCard({ pattern }: PatternCardProps) {
  if (!pattern) {
    return (
      <div className="bg-[#171717] border border-[#262626] rounded p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#A1A1AA]">
            Pattern Analysis V2
          </h3>
        </div>
        <div className="py-6 text-center text-[#737373] text-xs font-mono">
          SCANNING HISTORICAL SESSIONS…
        </div>
      </div>
    );
  }

  const detectedList = pattern.detected_patterns ?? [];
  const ctx = pattern.contextual_pattern;
  const isMarubozu = pattern.pattern !== "none";
  const hasPatterns = isMarubozu || detectedList.length > 0;
  const stopLoss = typeof pattern.stop_loss === "number"
    ? pattern.stop_loss
    : typeof detectedList[detectedList.length - 1]?.context?.stop_loss === "number"
    ? (detectedList[detectedList.length - 1].context.stop_loss as number)
    : null;

  // Primary pattern name
  const primaryName = isMarubozu
    ? pattern.pattern === "bullish_marubozu"
      ? "BULLISH MARUBOZU"
      : "BEARISH MARUBOZU"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].pattern.toUpperCase()
    : "NO CANDLE PATTERN";

  const isBullish = isMarubozu
    ? pattern.pattern === "bullish_marubozu"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].direction === "bullish"
    : false;

  const isBearish = isMarubozu
    ? pattern.pattern === "bearish_marubozu"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].direction === "bearish"
    : false;

  const badgeColor = isBullish
    ? "bg-[#22C55E]/10 border-[#22C55E]/40 text-[#22C55E]"
    : isBearish
    ? "bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444]"
    : "bg-[#27272A]/40 border-[#3F3F46] text-[#A1A1AA]";

  return (
    <div className="bg-[#171717] border border-[#262626] rounded p-3.5 select-none font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#262626] mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAFA]">
            Pattern Analysis
          </h3>
          <span className="text-[8.5px] px-1 bg-[#222] text-[#00E5FF] font-semibold">V2</span>
        </div>
        <span className="text-[9px] text-[#737373]">
          {pattern.signal_day ?? pattern.latest_candle?.date ?? "Latest Session"}
        </span>
      </div>

      {hasPatterns ? (
        <div className="space-y-3">
          {/* Primary Pattern Badge */}
          <div className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-bold ${badgeColor}`}>
            <div className="flex items-center gap-1.5">
              {isBullish ? <TrendingUp size={14} /> : isBearish ? <TrendingDown size={14} /> : <Layers size={14} />}
              <span>{primaryName}</span>
            </div>
            <CheckCircle2 size={13} />
          </div>

          {/* Rationale / Explanation */}
          <div className="bg-[#0A0A0A] border border-[#262626] rounded p-2.5 space-y-1 text-xs">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-semibold">
              Deterministic Interpretation
            </span>
            <p className="text-[#FAFAFA] text-[11px] leading-relaxed">
              {detectedList.length > 0
                ? detectedList[detectedList.length - 1].explanation
                : pattern.rationale}
            </p>
          </div>

          {/* Contextual Market Structure Alignment */}
          {ctx && (
            <div className="bg-[#050505] border border-[#1E1E1E] rounded p-2.5 space-y-1.5 text-[10px]">
              <span className="text-[9px] text-[#00E5FF] font-bold tracking-wider uppercase block">
                STRUCTURAL CONTEXT
              </span>
              <div className="grid grid-cols-2 gap-2 text-[#AAA]">
                <div>
                  <span className="text-[#555] block text-[8.5px]">NEAREST SUPPORT</span>
                  <span className="text-[#DDD] font-semibold">
                    {ctx.nearest_support_price ? `₹${ctx.nearest_support_price.toFixed(2)} (-${ctx.support_distance_pct}%)` : "None nearby"}
                  </span>
                </div>
                <div>
                  <span className="text-[#555] block text-[8.5px]">VOLUME PROFILE</span>
                  <span className="text-[#00E5FF] font-semibold">
                    {ctx.rvol}x RVOL ({ctx.volume_state})
                  </span>
                </div>
              </div>
              <div className="text-[#777] text-[9px] leading-relaxed pt-1 border-t border-[#151515]">
                {ctx.context_summary}
              </div>
            </div>
          )}

          {/* Stop Loss Level if available */}
          {typeof stopLoss === "number" && !isNaN(stopLoss) && (
            <div className="flex items-center justify-between bg-[#111111] border border-[#262626] rounded px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#EF4444]">
                <ShieldAlert size={13} />
                <span className="text-[11px] uppercase tracking-wider font-semibold">
                  Protective Stop Reference
                </span>
              </div>
              <span className="font-bold text-[#FAFAFA] tabular-nums">
                ₹{stopLoss.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
            <span className="font-semibold text-[#FAFAFA] tracking-wide">
              No Recognized Pattern
            </span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            No single or multi-candle pattern detected on the latest trading sessions.
          </p>
          <div className="pt-2 border-t border-[#262626]/60 flex items-start gap-1.5 text-[10px] text-[#737373] leading-normal">
            <ShieldCheck size={12} className="shrink-0 mt-0.5 text-[#A1A1AA]" />
            <span>
              Pattern Engine scans for Marubozu, Doji, Spinning Top, Hammer, Hanging Man, Engulfing, Harami, and Stars.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
