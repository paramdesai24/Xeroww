// src/components/VolumeAnalyticsPanel.tsx
// Institutional Volume Profile & RVOL Analytics Card.

import type { VolumeAnalyticsResponse } from "../types/structure";

interface Props {
  volume: VolumeAnalyticsResponse | null;
  loading?: boolean;
}

export default function VolumeAnalyticsPanel({ volume, loading }: Props) {
  if (loading && !volume) {
    return (
      <div className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] text-[10px] text-[#444] tracking-widest font-mono">
        CALCULATING VOLUME RVOL...
      </div>
    );
  }

  if (!volume) return null;

  const getVolStateBadge = (state: string) => {
    switch (state) {
      case "ELEVATED":
        return "border-[#00E5FF]/40 text-[#00E5FF] bg-[#00E5FF]/10";
      case "UNUSUALLY_LOW":
        return "border-[#71717A]/40 text-[#A1A1AA] bg-[#71717A]/10";
      default:
        return "border-[#27272A] text-[#A1A1AA] bg-[#18181B]/40";
    }
  };

  const getPvRelStyle = (rel: string) => {
    switch (rel) {
      case "ACCUMULATION":
        return "text-[#22C55E]";
      case "DISTRIBUTION":
        return "text-[#EF4444]";
      case "LOW_VOLUME_PULLBACK":
        return "text-[#F59E0B]";
      default:
        return "text-[#999]";
    }
  };

  return (
    <div
      id="volume-analytics-panel"
      className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] flex flex-col gap-2.5 font-mono select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#888] tracking-widest uppercase">
            VOLUME ENGINE
          </span>
          <span className="text-[#333] text-[10px]">·</span>
          <span className="text-[9px] text-[#555] tracking-wider uppercase">RVOL</span>
        </div>
        <div className="flex items-center gap-1.5">
          {volume.is_volume_spike && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 border border-[#F59E0B]/50 text-[#F59E0B] bg-[#F59E0B]/10 animate-pulse">
              SPIKE ≥2.0x
            </span>
          )}
          <span
            className={`text-[9px] font-bold px-2 py-0.5 border tracking-wider uppercase ${getVolStateBadge(
              volume.volume_state,
            )}`}
          >
            {volume.volume_state}
          </span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-3 gap-2 bg-[#050505] p-2 border border-[#151515] text-[10px]">
        <div>
          <span className="text-[#555] block text-[8.5px]">RVOL RATIO</span>
          <span className="text-[14px] font-bold text-[#00E5FF]">{volume.rvol}x</span>
        </div>
        <div>
          <span className="text-[#555] block text-[8.5px]">20D AVERAGE</span>
          <span className="text-[#DDD] font-semibold">{volume.baseline_avg_volume.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[#555] block text-[8.5px]">P/V DYNAMIC</span>
          <span className={`text-[9px] font-bold block mt-0.5 ${getPvRelStyle(volume.price_volume_relationship)}`}>
            {volume.price_volume_relationship.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Breakout & Divergence Flags */}
      <div className="flex flex-col gap-1 text-[9.5px]">
        {volume.breakout_confirmed && (
          <div className="flex items-center gap-1.5 text-[#22C55E]">
            <span>✓</span>
            <span>Volume confirms 10-session price breakout</span>
          </div>
        )}
        {volume.divergence_flag && (
          <div className="flex items-center gap-1.5 text-[#F59E0B]">
            <span>⚠</span>
            <span>{volume.divergence_flag}</span>
          </div>
        )}
        <p className="text-[#777] text-[9px] leading-relaxed mt-0.5">
          {volume.explanation}
        </p>
      </div>
    </div>
  );
}
