// src/components/PatternCard.tsx
// Candlestick Pattern Analysis — v2 composable primitives & natural typography.

import { CheckCircle2, TrendingUp, TrendingDown, Layers } from "lucide-react";
import type { PatternData } from "../types/market";
import { Panel, PanelHeader, Badge } from "./ui";

interface PatternCardProps {
  pattern: PatternData | null;
}

export default function PatternCard({ pattern }: PatternCardProps) {
  if (!pattern) {
    return (
      <Panel className="p-3">
        <PanelHeader title="Pattern Analysis" />
        <div className="py-4 text-center text-xs text-[var(--text-tertiary)]">
          Scanning historical sessions…
        </div>
      </Panel>
    );
  }

  const detectedList = pattern.detected_patterns ?? [];
  const ctx = pattern.contextual_pattern;
  const isMarubozu = pattern.pattern !== "none";
  const hasPatterns = isMarubozu || detectedList.length > 0;

  const primaryName = isMarubozu
    ? pattern.pattern === "bullish_marubozu"
      ? "Bullish Marubozu"
      : "Bearish Marubozu"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].pattern.replace(/_/g, " ")
    : "No Candle Pattern";

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

  const badgeVariant = isBullish ? "green" : isBearish ? "red" : "neutral";
  const accentEdge = isBullish ? "positive" : isBearish ? "negative" : "none";

  return (
    <Panel id="pattern-card" accentEdge={accentEdge} className="overflow-hidden">
      <PanelHeader
        title="Pattern Analysis"
        subtitle={pattern.signal_day ?? pattern.latest_candle?.date ?? "Latest session"}
        badge={
          <Badge variant="blue">
            V2
          </Badge>
        }
      />

      <div className="p-3 flex flex-col gap-2.5">
        {/* Primary Pattern Badge Pill */}
        <div
          className={`p-2.5 flex items-center justify-between border ${
            isBullish
              ? "bg-[var(--positive-subtle)] border-[var(--positive-border)]"
              : isBearish
              ? "bg-[var(--negative-subtle)] border-[var(--negative-border)]"
              : "bg-[var(--surface-inset)] border-[var(--border-default)]"
          }`}
        >
          <div className="flex items-center gap-2">
            {isBullish ? (
              <TrendingUp size={16} className="text-[var(--positive)]" />
            ) : isBearish ? (
              <TrendingDown size={16} className="text-[var(--negative)]" />
            ) : (
              <Layers size={16} className="text-[var(--text-secondary)]" />
            )}
            <span
              className={`text-xs font-bold capitalize ${
                isBullish ? "text-[var(--positive)]" : isBearish ? "text-[var(--negative)]" : "text-[var(--text-primary)]"
              }`}
            >
              {primaryName}
            </span>
          </div>
          {hasPatterns && (
            <CheckCircle2
              size={14}
              className={isBullish ? "text-[var(--positive)]" : isBearish ? "text-[var(--negative)]" : "text-[var(--text-secondary)]"}
            />
          )}
        </div>

        {/* Interpretation Box */}
        <div className="p-2.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
            Interpretation
          </span>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
            {detectedList.length > 0
              ? detectedList[detectedList.length - 1].explanation
              : pattern.rationale ?? "No specific candlestick formation observed in current session."}
          </p>
        </div>

        {/* Structural Context (if available) */}
        {ctx && (
          <div className="p-2.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-[var(--accent-primary)] uppercase tracking-wide">
              Structural Context
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">Nearest Support</span>
                <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                  {ctx.nearest_support_price
                    ? `₹${ctx.nearest_support_price.toFixed(2)} (-${ctx.support_distance_pct}%)`
                    : "None nearby"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">Nearest Resistance</span>
                <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                  {ctx.nearest_resistance_price
                    ? `₹${ctx.nearest_resistance_price.toFixed(2)} (+${ctx.resistance_distance_pct}%)`
                    : "None nearby"}
                </span>
              </div>
            </div>
            {ctx.context_summary && (
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0 border-t border-[var(--border-subtle)] pt-1.5">
                {ctx.context_summary}
              </p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
