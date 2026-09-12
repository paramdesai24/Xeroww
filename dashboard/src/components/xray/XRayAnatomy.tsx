// src/components/xray/XRayAnatomy.tsx
// Section 1: Deep Candle Anatomy deconstruction.
// Open, High, Low, Close, Absolute Body, Body %, Upper Wick, Lower Wick, Total Range, Bullish/Bearish.

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CandleAnatomyMetrics } from "../../types/xray";

interface XRayAnatomyProps {
  anatomy: CandleAnatomyMetrics;
  timestamp: string;
}

export function XRayAnatomy({ anatomy, timestamp }: XRayAnatomyProps) {
  const {
    open,
    high,
    low,
    close,
    bodySize,
    bodyPct,
    upperWick,
    upperWickPct,
    lowerWick,
    lowerWickPct,
    totalRange,
    classification,
    isBullish,
    isBearish,
    spreadToPreviousClose,
    spreadToPreviousClosePct,
  } = anatomy;

  return (
    <div className="bg-[#0D0D0D] border border-[#232323] p-4 flex flex-col gap-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]" style={{ fontFamily: "var(--font-mono)" }}>
            1. Candle Anatomy
          </span>
          <span className="text-[10px] text-[#6B6B72] font-mono">({timestamp})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 text-[11px] font-bold font-mono uppercase tracking-wide border rounded-sm flex items-center gap-1 ${
              isBullish
                ? "bg-[rgba(34,197,94,0.12)] text-[#22C55E] border-[rgba(34,197,94,0.35)]"
                : isBearish
                ? "bg-[rgba(239,68,68,0.12)] text-[#EF4444] border-[rgba(239,68,68,0.35)]"
                : "bg-[#161616] text-[#A0A0A8] border-[#333333]"
            }`}
          >
            {isBullish ? (
              <TrendingUp size={11} strokeWidth={2.5} />
            ) : isBearish ? (
              <TrendingDown size={11} strokeWidth={2.5} />
            ) : (
              <Minus size={11} strokeWidth={2.5} />
            )}
            {classification.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* OHLC 4-Cell Primary Matrix */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-[#05070B] border border-[#1A1A1A] p-2 rounded-sm">
          <div className="text-[10px] text-[#6B6B72] uppercase font-mono tracking-wider">Open</div>
          <div className="text-xs font-bold font-mono text-[#FAFAFA] tabular-nums mt-0.5">
            ₹{open.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#05070B] border border-[#1A1A1A] p-2 rounded-sm">
          <div className="text-[10px] text-[#6B6B72] uppercase font-mono tracking-wider">High</div>
          <div className="text-xs font-bold font-mono text-[#22C55E] tabular-nums mt-0.5">
            ₹{high.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#05070B] border border-[#1A1A1A] p-2 rounded-sm">
          <div className="text-[10px] text-[#6B6B72] uppercase font-mono tracking-wider">Low</div>
          <div className="text-xs font-bold font-mono text-[#EF4444] tabular-nums mt-0.5">
            ₹{low.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#05070B] border border-[#1A1A1A] p-2 rounded-sm">
          <div className="text-[10px] text-[#6B6B72] uppercase font-mono tracking-wider">Close</div>
          <div
            className={`text-xs font-bold font-mono tabular-nums mt-0.5 ${
              isBullish ? "text-[#22C55E]" : isBearish ? "text-[#EF4444]" : "text-[#FAFAFA]"
            }`}
          >
            ₹{close.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Stacked Proportional Distribution Bar */}
      <div className="flex flex-col gap-1.5 bg-[#080808] border border-[#1A1A1A] p-2.5 rounded-sm">
        <div className="flex justify-between items-center text-[10px] text-[#A0A0A8] font-mono">
          <span>GEOMETRIC RANGE ALLOCATION</span>
          <span className="text-[#FAFAFA] font-bold">₹{totalRange.toFixed(2)} Total Range</span>
        </div>

        {/* Visual Bar */}
        <div className="w-full h-3 bg-[#161616] rounded-sm overflow-hidden flex">
          {upperWickPct > 0 && (
            <div
              style={{ width: `${upperWickPct}%` }}
              className="bg-[#6B6B72] transition-all duration-300"
              title={`Upper Wick: ${upperWickPct.toFixed(1)}%`}
            />
          )}
          {bodyPct > 0 && (
            <div
              style={{ width: `${bodyPct}%` }}
              className={`${isBullish ? "bg-[#22C55E]" : isBearish ? "bg-[#EF4444]" : "bg-[#1E90FF]"} transition-all duration-300`}
              title={`Body: ${bodyPct.toFixed(1)}%`}
            />
          )}
          {lowerWickPct > 0 && (
            <div
              style={{ width: `${lowerWickPct}%` }}
              className="bg-[#44444A] transition-all duration-300"
              title={`Lower Wick: ${lowerWickPct.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[10px] font-mono mt-0.5">
          <span className="flex items-center gap-1 text-[#A0A0A8]">
            <span className="w-2 h-2 rounded-[1px] bg-[#6B6B72]" />
            Upper: {upperWickPct.toFixed(1)}%
          </span>
          <span className="flex items-center gap-1 text-[#FAFAFA] font-semibold">
            <span
              className={`w-2 h-2 rounded-[1px] ${
                isBullish ? "bg-[#22C55E]" : isBearish ? "bg-[#EF4444]" : "bg-[#1E90FF]"
              }`}
            />
            Body: {bodyPct.toFixed(1)}%
          </span>
          <span className="flex items-center gap-1 text-[#A0A0A8]">
            <span className="w-2 h-2 rounded-[1px] bg-[#44444A]" />
            Lower: {lowerWickPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Forensic Anatomy Breakdown Table */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="bg-[#080808] border border-[#1A1A1A] p-2 flex flex-col justify-between">
          <span className="text-[10px] text-[#6B6B72]">ABSOLUTE BODY SIZE</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-[#FAFAFA] tabular-nums">₹{bodySize.toFixed(2)}</span>
            <span className="text-[11px] text-[#1E90FF] font-semibold">{bodyPct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-[#080808] border border-[#1A1A1A] p-2 flex flex-col justify-between">
          <span className="text-[10px] text-[#6B6B72]">TOTAL BAR RANGE</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-[#FAFAFA] tabular-nums">₹{totalRange.toFixed(2)}</span>
            <span className="text-[11px] text-[#A0A0A8]">High - Low</span>
          </div>
        </div>

        <div className="bg-[#080808] border border-[#1A1A1A] p-2 flex flex-col justify-between">
          <span className="text-[10px] text-[#6B6B72]">UPPER WICK (REJECTION)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-[#FAFAFA] tabular-nums">₹{upperWick.toFixed(2)}</span>
            <span className="text-[11px] text-[#A0A0A8]">{upperWickPct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-[#080808] border border-[#1A1A1A] p-2 flex flex-col justify-between">
          <span className="text-[10px] text-[#6B6B72]">LOWER WICK (ABSORPTION)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-[#FAFAFA] tabular-nums">₹{lowerWick.toFixed(2)}</span>
            <span className="text-[11px] text-[#A0A0A8]">{lowerWickPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Session Momentum Spread */}
      {typeof spreadToPreviousClose === "number" && typeof spreadToPreviousClosePct === "number" && (
        <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1.5 bg-[#05070B] border border-[#1A1A1A]">
          <span className="text-[#6B6B72]">Change vs Prior Close:</span>
          <span
            className={`font-semibold tabular-nums ${
              spreadToPreviousClose > 0
                ? "text-[#22C55E]"
                : spreadToPreviousClose < 0
                ? "text-[#EF4444]"
                : "text-[#A0A0A8]"
            }`}
          >
            {spreadToPreviousClose > 0 ? "+" : ""}
            ₹{spreadToPreviousClose.toFixed(2)} ({spreadToPreviousClosePct > 0 ? "+" : ""}
            {spreadToPreviousClosePct.toFixed(2)}%)
          </span>
        </div>
      )}
    </div>
  );
}
