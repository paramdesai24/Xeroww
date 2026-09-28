// src/components/MarketRegimeCard.tsx
// Deterministic market regime classifier with composable primitives.

import type { MarketRegimeResponse } from "../types/structure";
import { Panel, PanelHeader, Badge, Metric } from "./ui";

interface Props {
  regime: MarketRegimeResponse | null;
  loading?: boolean;
}

export default function MarketRegimeCard({ regime, loading }: Props) {
  if (loading && !regime) {
    return (
      <Panel className="p-3">
        <span className="text-xs text-[var(--text-tertiary)]">Classifying market regime…</span>
      </Panel>
    );
  }

  if (!regime) return null;

  const isUp = regime.regime === "TRENDING_UP";
  const isDown = regime.regime === "TRENDING_DOWN";
  const isRange = regime.regime === "RANGE_BOUND";

  const badgeVariant = isUp ? "green" : isDown ? "red" : isRange ? "amber" : "blue";
  const accentEdge = isUp ? "positive" : isDown ? "negative" : "primary";
  const firstReason = regime.reasons[0] ?? "No evidence available";
  const briefReason = firstReason.split(/\s+/).slice(0, 8).join(" ");

  return (
    <Panel id="market-regime-card" accentEdge={accentEdge} className="overflow-hidden">
      <PanelHeader
        title="Market Regime"
        subtitle="Deterministic classification"
        badge={
          <Badge variant={badgeVariant} dot>
            {regime.regime.replace(/_/g, " ")}
          </Badge>
        }
      />

      {/* Metrics Row */}
      <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-2">
        <Metric label="ATR Vol" value={`${regime.atr_pct}%`} size="sm" />
        <Metric label="RVOL" value={`${regime.rvol}x`} size="sm" />
        <Metric label="EMA Trend" value={regime.ema_trend.replace(/_/g, " ")} size="sm" />
      </div>

      <div className="intelligence-brief"><span>Key evidence</span><strong title={firstReason}>{briefReason}{briefReason.length < firstReason.length ? "…" : ""}</strong></div>
      <details className="intelligence-audit"><summary>Inspect evidence ({regime.reasons.length})</summary><ul>{regime.reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}</ul></details>
    </Panel>
  );
}
