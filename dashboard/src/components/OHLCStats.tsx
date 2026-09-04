// src/components/OHLCStats.tsx
// Right panel — OHLC statistics card with day range visualizer.

import { ArrowUp, ArrowDown, Activity } from "lucide-react";
import type { OHLCData, QuoteData } from "../types/market";

interface OHLCStatsProps {
  quote: QuoteData | null;
  ohlc: OHLCData | null;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className="text-sm font-semibold text-slate-100 tabular-nums">{value}</span>
    </div>
  );
}

function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low;
  const pct = range > 0 ? ((current - low) / range) * 100 : 50;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
        <span>₹{low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        <span className="text-slate-400 font-medium">Day Range</span>
        <span>₹{high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full overflow-visible">
        <div
          className="absolute h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 rounded-full opacity-40"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-white/20 border-2 border-slate-900 transition-all duration-500"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  );
}

export default function OHLCStats({ quote, ohlc }: OHLCStatsProps) {
  const latest = ohlc?.candles.at(-1) ?? null;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className="text-indigo-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Session Stats
        </h3>
      </div>

      {quote && latest ? (
        <>
          {/* Range bar */}
          <RangeBar low={quote.day_low} high={quote.day_high} current={quote.price} />

          {/* Stats grid */}
          <div className="mt-4">
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
              label="Close (Prev)"
              value={`₹${quote.previous_close.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            />
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

          {/* 1M OHLC from candle data */}
          {ohlc && ohlc.candles.length > 0 && (() => {
            const highs = ohlc.candles.map((c) => c.high);
            const lows = ohlc.candles.map((c) => c.low);
            const monthHigh = Math.max(...highs);
            const monthLow = Math.min(...lows);
            return (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
                  1-Month Range
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ArrowDown size={12} className="text-red-400" />
                    <span className="text-xs text-slate-300">
                      ₹{monthLow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowUp size={12} className="text-emerald-400" />
                    <span className="text-xs text-slate-300">
                      ₹{monthHigh.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="py-6 text-center text-slate-600 text-sm">
          No data available
        </div>
      )}
    </div>
  );
}
