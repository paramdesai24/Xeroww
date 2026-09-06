// src/components/SupportResistancePanel.tsx
// Institutional Support & Resistance Levels and Cluster Strength Panel.

import type { SupportResistanceResponse } from "../types/structure";

interface Props {
  sr: SupportResistanceResponse | null;
  loading?: boolean;
}

export default function SupportResistancePanel({ sr, loading }: Props) {
  if (loading && !sr) {
    return (
      <div className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] text-[10px] text-[#444] tracking-widest font-mono">
        COMPUTING SUPPORT & RESISTANCE ZONES...
      </div>
    );
  }

  if (!sr) return null;

  return (
    <div
      id="support-resistance-panel"
      className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] flex flex-col gap-2.5 font-mono select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#888] tracking-widest uppercase">
            S/R ZONES
          </span>
          <span className="text-[#333] text-[10px]">·</span>
          <span className="text-[9px] text-[#555] tracking-wider uppercase">
            SWING CLUSTERS
          </span>
        </div>
        <span className="text-[9px] text-[#666] tracking-wider">
          {sr.total_swings_detected} PIVOTS
        </span>
      </div>

      {/* Nearest Levels Banner */}
      <div className="grid grid-cols-2 gap-2 bg-[#050505] p-2 border border-[#151515] text-[10px]">
        {/* Nearest Support */}
        <div className="flex flex-col">
          <span className="text-[8.5px] text-[#555] tracking-wider uppercase">
            NEAREST SUPPORT
          </span>
          {sr.nearest_support ? (
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[12px] font-bold text-[#22C55E]">
                ₹{sr.nearest_support.price.toFixed(2)}
              </span>
              <span className="text-[9px] text-[#555]">
                (-{sr.nearest_support.distance_pct}%)
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-[#555]">—</span>
          )}
        </div>

        {/* Nearest Resistance */}
        <div className="flex flex-col">
          <span className="text-[8.5px] text-[#555] tracking-wider uppercase">
            NEAREST RESISTANCE
          </span>
          {sr.nearest_resistance ? (
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[12px] font-bold text-[#EF4444]">
                ₹{sr.nearest_resistance.price.toFixed(2)}
              </span>
              <span className="text-[9px] text-[#555]">
                (+{sr.nearest_resistance.distance_pct}%)
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-[#555]">—</span>
          )}
        </div>
      </div>

      {/* Level List */}
      <div className="flex flex-col gap-1 text-[9.5px]">
        <div className="flex items-center justify-between text-[#555] text-[8.5px] uppercase border-b border-[#151515] pb-1">
          <span>LEVEL</span>
          <div className="flex items-center gap-3">
            <span>TOUCHES</span>
            <span>STRENGTH</span>
          </div>
        </div>

        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
          {/* Resistances (Ascending) */}
          {sr.resistance_zones.slice(0, 3).map((z, idx) => (
            <div
              key={`res-${idx}`}
              className="flex items-center justify-between text-[#DDD] p-1 bg-[#050505] border border-[#18181B]"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] px-1 bg-[#EF4444]/20 text-[#EF4444] font-bold">
                  RES
                </span>
                <span className="font-semibold text-[10px]">₹{z.price.toFixed(2)}</span>
                <span className="text-[#666] text-[8.5px]">+{z.distance_pct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#888]">{z.touches}x</span>
                <div className="w-10 h-1.5 bg-[#1F1F23] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#EF4444]"
                    style={{ width: `${(z.strength / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Supports (Descending) */}
          {sr.support_zones.slice(0, 3).map((z, idx) => (
            <div
              key={`sup-${idx}`}
              className="flex items-center justify-between text-[#DDD] p-1 bg-[#050505] border border-[#18181B]"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] px-1 bg-[#22C55E]/20 text-[#22C55E] font-bold">
                  SUP
                </span>
                <span className="font-semibold text-[10px]">₹{z.price.toFixed(2)}</span>
                <span className="text-[#666] text-[8.5px]">-{z.distance_pct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#888]">{z.touches}x</span>
                <div className="w-10 h-1.5 bg-[#1F1F23] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#22C55E]"
                    style={{ width: `${(z.strength / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
