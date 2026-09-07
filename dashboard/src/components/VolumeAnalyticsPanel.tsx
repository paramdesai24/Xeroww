// src/components/VolumeAnalyticsPanel.tsx
// Institutional Volume Profile & RVOL Analytics — v2 composable primitives & natural typography.

import type { VolumeAnalyticsResponse } from "../types/structure";
import { Panel, PanelHeader, Badge, Metric } from "./ui";

interface Props {
  volume: VolumeAnalyticsResponse | null;
  loading?: boolean;
}

export default function VolumeAnalyticsPanel({ volume, loading }: Props) {
  if (loading && !volume) {
    return (
      <Panel className="p-3">
        <span className="text-xs text-[var(--text-tertiary)]">Calculating volume metrics…</span>
      </Panel>
    );
  }

  if (!volume) return null;

  const isElevated = volume.volume_state === "ELEVATED";
  const isAccumulation = volume.price_volume_relationship === "ACCUMULATION";
  const isDistribution = volume.price_volume_relationship === "DISTRIBUTION";

  return (
    <Panel id="volume-analytics-panel" className="overflow-hidden">
      <PanelHeader
        title="Volume Engine"
        subtitle="RVOL & Price-Volume Relationship"
        badge={
          <div className="flex items-center gap-1.5">
            {volume.is_volume_spike && (
              <Badge variant="amber" dot>
                Spike ≥2×
              </Badge>
            )}
            <Badge variant={isElevated ? "amber" : "neutral"}>
              {volume.volume_state}
            </Badge>
          </div>
        }
      />

      {/* Primary Volume Metrics */}
      <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-3">
        <Metric label="RVOL" value={`${volume.rvol}x`} size="sm" />
        <Metric label="State" value={volume.volume_state} size="sm" />
        <Metric label="Baseline" value={`${(volume.baseline_avg_volume / 1e5).toFixed(1)}L`} size="sm" />
      </div>

      {/* Derived Insight */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-tertiary)] font-medium">Flow Context</span>
          <span
            className={`font-semibold capitalize ${
              isAccumulation
                ? "text-[var(--positive)]"
                : isDistribution
                ? "text-[var(--negative)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {volume.price_volume_relationship.replace(/_/g, " ")}
          </span>
        </div>

        {volume.divergence_flag && (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0 p-2 bg-[var(--surface-inset)] border border-[var(--border-subtle)]">
            {volume.divergence_flag}
          </p>
        )}
      </div>
    </Panel>
  );
}
