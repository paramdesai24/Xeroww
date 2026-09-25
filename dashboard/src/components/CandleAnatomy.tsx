// src/components/CandleAnatomy.tsx
// Candle anatomy breakdown with composable primitives and natural typography.

import type { OHLCBar } from "../types/market";
import { Panel, PanelHeader, Badge } from "./ui";

interface CandleAnatomyProps {
  candle: OHLCBar | null;
  isLatest?: boolean;
}

export default function CandleAnatomy({ candle, isLatest = false }: CandleAnatomyProps) {
  if (!candle) {
    return (
      <Panel className="p-3">
        <PanelHeader title="Candle Anatomy" />
        <div className="py-4 text-center text-xs text-[var(--text-tertiary)]">
          Select a candle on chart…
        </div>
      </Panel>
    );
  }

  const bodySize = Math.abs(candle.close - candle.open);
  const upperShadow = Math.max(candle.high - Math.max(candle.open, candle.close), 0);
  const lowerShadow = Math.max(Math.min(candle.open, candle.close) - candle.low, 0);
  const totalRange = candle.high - candle.low;
  const bodyRatio = totalRange > 0 ? (bodySize / totalRange) * 100 : 0;
  const wickRatio = totalRange > 0 ? ((upperShadow + lowerShadow) / totalRange) * 100 : 0;
  const isBullish = candle.close >= candle.open;

  return (
    <Panel id="candle-anatomy-card" className="overflow-hidden">
      <PanelHeader
        title="Candle Anatomy"
        subtitle={candle.time}
        badge={
          <div className="flex items-center gap-1.5">
            {isLatest && <Badge variant="outline">Latest</Badge>}
            <Badge variant={isBullish ? "green" : "red"}>
              {isBullish ? "Bullish" : "Bearish"}
            </Badge>
          </div>
        }
      />

      <div className="p-3 flex flex-col gap-3">
        {/* Ratios strip */}
        <div className="p-2.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-label text-[var(--text-tertiary)] block">Body Ratio</span>
            <span className="font-bold text-[var(--text-primary)] font-mono tabular-nums">
              {bodyRatio.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-label text-[var(--text-tertiary)] block">Wick Ratio</span>
            <span className="font-bold text-[var(--text-primary)] font-mono tabular-nums">
              {wickRatio.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* OHLC breakdown list */}
        <div className="flex flex-col text-xs divide-y divide-[var(--border-subtle)]">
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-secondary)]">Open</span>
            <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
              ₹{candle.open.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-secondary)]">High</span>
            <span className="font-semibold text-[var(--positive)] font-mono tabular-nums">
              ₹{candle.high.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-secondary)]">Low</span>
            <span className="font-semibold text-[var(--negative)] font-mono tabular-nums">
              ₹{candle.low.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-secondary)]">Close</span>
            <span className={`font-semibold font-mono tabular-nums ${isBullish ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
              ₹{candle.close.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-secondary)]">Range</span>
            <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
              ₹{totalRange.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
