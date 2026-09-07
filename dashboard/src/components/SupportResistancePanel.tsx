// src/components/SupportResistancePanel.tsx
// Institutional Support & Resistance Zones — v2 composable primitives & natural typography.

import type { SupportResistanceResponse } from "../types/structure";
import { Panel, PanelHeader, Badge } from "./ui";

interface Props {
  sr: SupportResistanceResponse | null;
  loading?: boolean;
}

function StrengthBar({ value }: { value: number }) {
  return (
    <div className="w-10 h-1 bg-[var(--border-default)] overflow-hidden shrink-0">
      <div
        className="h-full bg-[var(--accent-primary)]"
        style={{ width: `${(value / 10) * 100}%` }}
      />
    </div>
  );
}

export default function SupportResistancePanel({ sr, loading }: Props) {
  if (loading && !sr) {
    return (
      <Panel className="p-3">
        <span className="text-xs text-[var(--text-tertiary)]">Computing support &amp; resistance zones…</span>
      </Panel>
    );
  }

  if (!sr) return null;

  return (
    <Panel id="support-resistance-panel" className="overflow-hidden">
      <PanelHeader
        title="Support & Resistance"
        subtitle="Swing cluster pivots"
        badge={
          <Badge variant="outline">
            {sr.total_swings_detected} pivots
          </Badge>
        }
      />

      {/* Nearest Levels Grid */}
      <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Nearest Support</span>
          {sr.nearest_support ? (
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-xs font-bold text-[var(--positive)] tabular-nums">
                ₹{sr.nearest_support.price.toFixed(2)}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                -{sr.nearest_support.distance_pct}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-[var(--text-disabled)] font-mono">—</span>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Nearest Resistance</span>
          {sr.nearest_resistance ? (
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-xs font-bold text-[var(--negative)] tabular-nums">
                ₹{sr.nearest_resistance.price.toFixed(2)}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                +{sr.nearest_resistance.distance_pct}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-[var(--text-disabled)] font-mono">—</span>
          )}
        </div>
      </div>

      {/* Level List */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] font-medium pb-1 border-b border-[var(--border-subtle)]">
          <span>Level</span>
          <div className="flex items-center gap-4">
            <span>Touches</span>
            <span>Strength</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
          {/* Resistance levels */}
          {sr.resistance_zones.slice(0, 3).map((z, idx) => (
            <div
              key={`res-${idx}`}
              className="p-1.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <Badge variant="red" size="sm">RES</Badge>
                <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                  ₹{z.price.toFixed(2)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-mono tabular-nums">
                  +{z.distance_pct}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  {z.touches}x
                </span>
                <StrengthBar value={z.strength} />
              </div>
            </div>
          ))}

          {/* Support levels */}
          {sr.support_zones.slice(0, 3).map((z, idx) => (
            <div
              key={`sup-${idx}`}
              className="p-1.5 bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <Badge variant="green" size="sm">SUP</Badge>
                <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                  ₹{z.price.toFixed(2)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-mono tabular-nums">
                  -{z.distance_pct}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  {z.touches}x
                </span>
                <StrengthBar value={z.strength} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
