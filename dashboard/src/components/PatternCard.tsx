// src/components/PatternCard.tsx
// Right panel — Candlestick Pattern Analysis & Trade Interpretations.

import { ShieldCheck, ShieldAlert, MinusCircle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
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
            Pattern Analysis
          </h3>
        </div>
        <div className="py-6 text-center text-[#737373] text-xs font-mono">
          SCANNING HISTORICAL SESSIONS…
        </div>
      </div>
    );
  }

  const isDetected = pattern.pattern !== "none";
  const isBullish = pattern.pattern === "bullish_marubozu";
  const candle = pattern.latest_candle;

  return (
    <div className="bg-[#171717] border border-[#262626] rounded p-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-[#262626] mb-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FAFAFA]">
          Pattern Analysis
        </h3>
        <span className="text-[9px] font-mono text-[#737373]">
          {pattern.signal_day ?? candle.date}
        </span>
      </div>

      {/* State 1: Pattern Detected */}
      {isDetected ? (
        <div className="space-y-3">
          {/* Bullish / Bearish Confirmation Badge */}
          <div
            className={`flex items-center justify-between px-3 py-2 rounded border font-mono text-xs font-bold ${
              isBullish
                ? "bg-[#22C55E]/10 border-[#22C55E]/40 text-[#22C55E]"
                : "bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isBullish ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{isBullish ? "BULLISH MARUBOZU" : "BEARISH MARUBOZU"}</span>
            </div>
            <CheckCircle2 size={13} />
          </div>

          {/* Trading Interpretation & Setup Rationale */}
          <div className="bg-[#0A0A0A] border border-[#262626] rounded p-2.5 space-y-1 text-xs font-mono">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-semibold">
              Trading Interpretation
            </span>
            <p className="text-[#FAFAFA] text-[11px] leading-relaxed">
              {pattern.rationale}
            </p>
          </div>

          {/* Protective Stop Loss */}
          {pattern.stop_loss !== null && (
            <div className="flex items-center justify-between bg-[#111111] border border-[#262626] rounded px-3 py-2 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-[#EF4444]">
                <ShieldAlert size={13} />
                <span className="text-[11px] uppercase tracking-wider font-semibold">
                  Protective Stop
                </span>
              </div>
              <span className="font-bold text-[#FAFAFA] tabular-nums">
                ₹{pattern.stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* State 2: No Pattern Detected (Neutral institutional layout, no large empty badge) */
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A1A1AA]">
            <MinusCircle size={14} className="text-[#737373] shrink-0" />
            <span className="font-semibold text-[#FAFAFA] tracking-wide">
              No Recognized Pattern
            </span>
          </div>

          {/* Clean neutral explanation */}
          <p className="text-[11px] font-mono text-[#A1A1AA] leading-relaxed">
            No recognized candlestick pattern detected on the latest trading session.
          </p>

          {/* Neutral detection criteria reminder */}
          <div className="pt-2 border-t border-[#262626]/60 flex items-start gap-1.5 text-[10px] font-mono text-[#737373] leading-normal">
            <ShieldCheck size={12} className="shrink-0 mt-0.5 text-[#A1A1AA]" />
            <span>
              <strong className="text-[#A1A1AA]">Detection Criteria:</strong> A Marubozu requires a dominant candle body with negligible upper and lower shadows.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
