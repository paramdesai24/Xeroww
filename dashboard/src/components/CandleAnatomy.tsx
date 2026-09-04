// src/components/CandleAnatomy.tsx
// Right panel — Interactive Candle Anatomy breakdown with Body & Wick ratios.

import type { OHLCBar } from "../types/market";

interface CandleAnatomyProps {
  candle: OHLCBar | null;
  isLatest?: boolean;
}

export default function CandleAnatomy({ candle, isLatest = false }: CandleAnatomyProps) {
  if (!candle) {
    return (
      <div className="bg-[#171717] border border-[#262626] rounded p-3.5 font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA]">
            Candle Anatomy
          </h3>
        </div>
        <div className="py-6 text-center text-[#737373] text-xs">
          SELECT A CANDLE ON CHART…
        </div>
      </div>
    );
  }

  // Exact calculations requested
  const bodySize = Math.abs(candle.close - candle.open);
  const upperShadow = Math.max(candle.high - Math.max(candle.open, candle.close), 0);
  const lowerShadow = Math.max(Math.min(candle.open, candle.close) - candle.low, 0);
  const totalRange = candle.high - candle.low;

  const bodyRatio = totalRange > 0 ? (bodySize / totalRange) * 100 : 0;
  const wickRatio = totalRange > 0 ? ((upperShadow + lowerShadow) / totalRange) * 100 : 0;

  const isBullish = candle.close >= candle.open;

  return (
    <div className="bg-[#171717] border border-[#262626] rounded p-3.5 font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#262626] mb-2.5">
        <div className="flex items-baseline gap-1.5">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAFA]">
            Candle Anatomy
          </h3>
          {isLatest && (
            <span className="text-[9px] text-[#A1A1AA] uppercase tracking-wider">
              (Latest)
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#737373] tabular-nums">
          {candle.time}
        </span>
      </div>

      {/* Primary OHLC values */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#A1A1AA] mb-3">
        <div className="flex justify-between border-b border-[#262626]/40 pb-0.5">
          <span className="text-[#737373]">OPEN</span>
          <span className="text-[#FAFAFA] tabular-nums font-medium">
            ₹{candle.open.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#262626]/40 pb-0.5">
          <span className="text-[#737373]">HIGH</span>
          <span className="text-[#FAFAFA] tabular-nums font-medium">
            ₹{candle.high.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#262626]/40 pb-0.5">
          <span className="text-[#737373]">LOW</span>
          <span className="text-[#FAFAFA] tabular-nums font-medium">
            ₹{candle.low.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#262626]/40 pb-0.5">
          <span className="text-[#737373]">CLOSE</span>
          <span
            className={`tabular-nums font-medium ${
              isBullish ? "text-[#22C55E]" : "text-[#EF4444]"
            }`}
          >
            ₹{candle.close.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Structural Metrics: Body Size, Upper Shadow, Lower Shadow */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded p-2 mb-3 space-y-1 text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#A1A1AA]">Body Size</span>
          <span className="text-[#FAFAFA] font-medium tabular-nums">
            ₹{bodySize.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#A1A1AA]">Upper Shadow</span>
          <span className="text-[#FAFAFA] font-medium tabular-nums">
            ₹{upperShadow.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#A1A1AA]">Lower Shadow</span>
          <span className="text-[#FAFAFA] font-medium tabular-nums">
            ₹{lowerShadow.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Dynamic Ratio Progress Bars */}
      <div className="space-y-2 text-[10px]">
        {/* Body Ratio */}
        <div>
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span>BODY RATIO</span>
            <span className="text-[#FAFAFA] font-bold tabular-nums">
              {bodyRatio.toFixed(1)}%
            </span>
          </div>
          <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                isBullish ? "bg-[#22C55E]" : "bg-[#EF4444]"
              }`}
              style={{ width: `${Math.min(bodyRatio, 100)}%` }}
            />
          </div>
        </div>

        {/* Wick Ratio */}
        <div>
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span>WICK RATIO</span>
            <span className="text-[#FAFAFA] font-bold tabular-nums">
              {wickRatio.toFixed(1)}%
            </span>
          </div>
          <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6366F1] rounded-full transition-all duration-200"
              style={{ width: `${Math.min(wickRatio, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
