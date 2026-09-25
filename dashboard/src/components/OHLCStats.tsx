// src/components/OHLCStats.tsx
// Session Analytics panel with composable primitives and natural typography.

import type { OHLCData, QuoteData } from "../types/market";
import { Panel, PanelHeader } from "./ui";

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
      ? "text-[var(--positive)]"
      : highlight === "bear"
      ? "text-[var(--negative)]"
      : "text-[var(--text-primary)]";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] text-xs">
      <span className="text-[var(--text-secondary)] font-normal">{label}</span>
      <span className={`font-semibold font-mono tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

export default function OHLCStats({ quote, ohlc }: OHLCStatsProps) {
  if (!quote || !ohlc || !ohlc.candles || ohlc.candles.length === 0) {
    return (
      <Panel className="p-3">
        <span className="text-xs text-[var(--text-tertiary)]">Loading session statistics…</span>
      </Panel>
    );
  }

  const latest = ohlc.candles[ohlc.candles.length - 1];
  const prev = ohlc.candles.length > 1 ? ohlc.candles[ohlc.candles.length - 2] : null;

  const dayRange = quote.day_high - quote.day_low;
  const dayRangePct = quote.day_low > 0 ? (dayRange / quote.day_low) * 100 : 0;
  const rangePosition =
    dayRange > 0
      ? Math.min(Math.max(((quote.price - quote.day_low) / dayRange) * 100, 0), 100)
      : 50;

  const gap = prev ? latest.open - prev.close : 0;
  const gapPct = prev && prev.close > 0 ? (gap / prev.close) * 100 : 0;

  return (
    <Panel id="ohlc-stats-card" className="overflow-hidden">
      <PanelHeader
        title="Session Statistics"
        subtitle={quote.symbol.replace(".NS", "")}
      />

      <div className="p-3 flex flex-col gap-3">
        {/* Day Range Visual Bar */}
        <div className="p-2.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>₹{quote.day_low.toFixed(1)}</span>
            <span className="text-label text-[var(--text-tertiary)] font-sans">Session Range ({dayRangePct.toFixed(1)}%)</span>
            <span>₹{quote.day_high.toFixed(1)}</span>
          </div>

          <div className="relative h-1.5 bg-[var(--border-default)] overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-[var(--accent-primary)]"
              style={{ left: 0, width: `${rangePosition}%` }}
            />
          </div>
        </div>

        {/* Key Metrics List */}
        <div className="flex flex-col">
          <StatRow
            label="Open"
            value={`₹${latest.open.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          />
          <StatRow
            label="Day High"
            value={`₹${quote.day_high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            highlight="bull"
          />
          <StatRow
            label="Day Low"
            value={`₹${quote.day_low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            highlight="bear"
          />
          <StatRow
            label="Previous Close"
            value={`₹${quote.previous_close.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          />
          <StatRow
            label="Session Gap"
            value={`${gap >= 0 ? "+" : ""}₹${gap.toFixed(2)} (${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(2)}%)`}
            highlight={gap > 0 ? "bull" : gap < 0 ? "bear" : null}
          />
          <StatRow
            label="Volume (Session)"
            value={`${(quote.volume / 1e5).toFixed(2)} Lakh`}
          />
        </div>
      </div>
    </Panel>
  );
}
