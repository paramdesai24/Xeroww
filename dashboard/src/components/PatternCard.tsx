// src/components/PatternCard.tsx
// Right panel — Varsity Marubozu detection & Latest Candle Summary (Terminal Refactor).

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
            Pattern Engine
          </h3>
        </div>
        <div className="py-6 text-center text-[#737373] text-xs font-mono">
          SCANNING HISTORICAL BARS…
        </div>
      </div>
    );
  }

  const isDetected = pattern.pattern !== "none";
  const isBullish = pattern.pattern === "bullish_marubozu";
  const candle = pattern.latest_candle;

  return (
    <div className="space-y-3">
      {/* Pattern Detection Card */}
      <div className="bg-[#171717] border border-[#262626] rounded p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#262626] mb-3">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FAFAFA]">
            Varsity Pattern Scan
          </h3>
          <span className="text-[9px] font-mono text-[#737373]">
            {pattern.signal_day ?? candle.date}
          </span>
        </div>

        {/* State 1: Pattern Detected */}
        {isDetected ? (
          <div className="space-y-3">
            {/* Strong Bullish/Bearish Badge */}
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

            {/* Why Qualified & Entry Reminder */}
            <div className="bg-[#0A0A0A] border border-[#262626] rounded p-2.5 space-y-1.5 text-xs font-mono">
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-semibold">
                Setup Rationale
              </span>
              <p className="text-[#FAFAFA] text-[11px] leading-relaxed">
                {pattern.rationale}
              </p>
            </div>

            {/* Stop Loss Reminder */}
            {pattern.stop_loss !== null && (
              <div className="flex items-center justify-between bg-[#111111] border border-[#262626] rounded px-3 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5 text-[#EF4444]">
                  <ShieldAlert size={13} />
                  <span className="text-[11px] uppercase tracking-wider font-semibold">
                    Stop Loss
                  </span>
                </div>
                <span className="font-bold text-[#FAFAFA] tabular-nums">
                  ₹{pattern.stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* State 2: No Marubozu Exists (Clean neutral layout, NO large empty badge) */
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono text-[#A1A1AA]">
              <MinusCircle size={14} className="text-[#737373] shrink-0" />
              <span className="font-semibold text-[#FAFAFA] tracking-wide">
                No Textbook Pattern
              </span>
            </div>

            {/* One-sentence explanation */}
            <p className="text-[11px] font-mono text-[#A1A1AA] leading-relaxed">
              {pattern.rationale}
            </p>

            {/* Varsity rule reminder */}
            <div className="pt-2 border-t border-[#262626]/60 flex items-start gap-1.5 text-[10px] font-mono text-[#737373] leading-normal">
              <ShieldCheck size={12} className="shrink-0 mt-0.5 text-[#A1A1AA]" />
              <span>
                <strong className="text-[#A1A1AA]">Varsity Rule:</strong> Marubozu requires open = low (or high) with ≥80% body and near-zero wicks.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Latest Candle Summary Card */}
      <div className="bg-[#171717] border border-[#262626] rounded p-3.5 font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-[#262626] mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAFA]">
            Candle Structure
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              candle.direction === "bullish"
                ? "text-[#22C55E]"
                : candle.direction === "bearish"
                ? "text-[#EF4444]"
                : "text-[#A1A1AA]"
            }`}
          >
            {candle.direction}
          </span>
        </div>

        {/* Body % and Range % bars */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-[#0A0A0A] border border-[#262626] rounded p-2">
            <div className="flex items-center justify-between text-[10px] text-[#A1A1AA] mb-1">
              <span>BODY RATIO</span>
              <span className="text-[#FAFAFA] font-bold tabular-nums">
                {candle.body_pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  candle.direction === "bullish" ? "bg-[#22C55E]" : "bg-[#EF4444]"
                }`}
                style={{ width: `${Math.min(candle.body_pct, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded p-2">
            <div className="flex items-center justify-between text-[10px] text-[#A1A1AA] mb-1">
              <span>VOLATILITY</span>
              <span className="text-[#FAFAFA] font-bold tabular-nums">
                {candle.range_pct.toFixed(2)}%
              </span>
            </div>
            <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(candle.range_pct * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* OHLC Mini Breakdown */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#A1A1AA] pt-1">
          <div className="flex justify-between border-b border-[#262626]/30 pb-0.5">
            <span>O:</span>
            <span className="text-[#FAFAFA] tabular-nums">₹{candle.open.toFixed(1)}</span>
          </div>
          <div className="flex justify-between border-b border-[#262626]/30 pb-0.5">
            <span>H:</span>
            <span className="text-[#FAFAFA] tabular-nums">₹{candle.high.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>L:</span>
            <span className="text-[#FAFAFA] tabular-nums">₹{candle.low.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>C:</span>
            <span className="text-[#FAFAFA] tabular-nums">₹{candle.close.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
