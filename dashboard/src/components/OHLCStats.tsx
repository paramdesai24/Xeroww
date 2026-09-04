// src/components/OHLCStats.tsx
// Right panel — Institutional Session Stats with Body Size and Daily Return.

import { ArrowUp, ArrowDown } from "lucide-react";
import type { OHLCData, QuoteData } from "../types/market";

interface OHLCStatsProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "bull" | "bear" | null;
}) {
  const valueColor =
    highlight === "bull"
      ? "text-[#22C55E]"
      : highlight === "bear"
      ? "text-[#EF4444]"
      : "text-[#FAFAFA]";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#262626]/50 last:border-0 text-xs font-mono">
      <span className="text-[#A1A1AA] text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`font-medium tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low;
  const pct = range > 0 ? Math.min(Math.max(((current - low) / range) * 100, 0), 100) : 50;

  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono text-[#A1A1AA] mb-1 tabular-nums">
        <span>₹{low.toFixed(1)}</span>
        <span className="text-[#737373] uppercase tracking-widest text-[9px]">Session Range</span>
        <span>₹{high.toFixed(1)}</span>
      </div>
      <div className="relative h-1.5 bg-[#262626] rounded-full overflow-visible">
        {/* Red low boundary indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#EF4444] rounded-l-full" />
        {/* Green high boundary indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-[#22C55E] rounded-r-full" />
        {/* Current price marker pin */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FAFAFA] shadow border border-[#000000] transition-all duration-300"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
    </div>
  );
}

export default function OHLCStats({ quote, ohlc }: OHLCStatsProps) {
  const latest = ohlc?.candles.at(-1) ?? null;

  // New calculations requested for V0.5 terminal
  const bodySize = latest ? Math.abs(latest.close - latest.open) : null;
  const dailyReturn = latest && latest.open > 0 ? ((latest.close - latest.open) / latest.open) * 100 : null;

  return (
    <div className="bg-[#171717] border border-[#262626] rounded p-3.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#262626]">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FAFAFA]">
          Session Analytics
        </h3>
        <span className="text-[9px] font-mono text-[#737373]">
          {latest ? latest.time : "DAILY"}
        </span>
      </div>

      {quote && latest ? (
        <>
          {/* Day Range Bar */}
          <RangeBar low={quote.day_low} high={quote.day_high} current={quote.price} />

          {/* Stats Rows */}
          <div className="mt-3 divide-y divide-[#262626]/40">
            <StatRow
              label="Open"
              value={`₹${latest.open.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            />
            <StatRow
              label="High"
              value={`₹${quote.day_high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            />
            <StatRow
              label="Low"
              value={`₹${quote.day_low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            />
            <StatRow
              label="Close (Last)"
              value={`₹${latest.close.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            />

            {/* Calculated Terminal Metrics */}
            {bodySize !== null && (
              <StatRow
                label="Body Size"
                value={`₹${bodySize.toFixed(2)}`}
              />
            )}
            {dailyReturn !== null && (
              <StatRow
                label="Daily Return"
                value={`${dailyReturn >= 0 ? "+" : ""}${dailyReturn.toFixed(2)}%`}
                highlight={dailyReturn > 0 ? "bull" : dailyReturn < 0 ? "bear" : null}
              />
            )}

            <StatRow
              label="Volume"
              value={quote.volume.toLocaleString("en-IN")}
            />
            {quote.market_cap && (
              <StatRow
                label="Market Cap"
                value={`₹${(quote.market_cap / 1e12).toFixed(2)}T`}
              />
            )}
          </div>

          {/* 1-Month Range stats */}
          {ohlc && ohlc.candles.length > 0 && (() => {
            const highs = ohlc.candles.map((c) => c.high);
            const lows = ohlc.candles.map((c) => c.low);
            const monthHigh = Math.max(...highs);
            const monthLow = Math.min(...lows);
            return (
              <div className="mt-3 pt-2.5 border-t border-[#262626]">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#737373] uppercase tracking-widest mb-1.5">
                  <span>1M Range</span>
                  <span>Low / High</span>
                </div>
                <div className="flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-1 text-[#EF4444]">
                    <ArrowDown size={11} className="stroke-[2.5]" />
                    <span className="tabular-nums">₹{monthLow.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#22C55E]">
                    <ArrowUp size={11} className="stroke-[2.5]" />
                    <span className="tabular-nums">₹{monthHigh.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="py-6 text-center text-[#737373] text-xs font-mono">
          AWAITING QUOTE…
        </div>
      )}
    </div>
  );
}
