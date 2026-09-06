// src/components/MarketRegimeCard.tsx
// Deterministic market regime classifier panel — pitch-black terminal styling.

import type { MarketRegimeResponse } from "../types/structure";

interface Props {
  regime: MarketRegimeResponse | null;
  loading?: boolean;
}

export default function MarketRegimeCard({ regime, loading }: Props) {
  if (loading && !regime) {
    return (
      <div className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] text-[10px] text-[#444] tracking-widest font-mono">
        CLASSIFYING MARKET REGIME...
      </div>
    );
  }

  if (!regime) return null;

  const getBadgeStyle = (r: string) => {
    switch (r) {
      case "TRENDING_UP":
        return "border-[#00E5FF]/40 text-[#00E5FF] bg-[#00E5FF]/10";
      case "TRENDING_DOWN":
        return "border-[#EF4444]/40 text-[#EF4444] bg-[#EF4444]/10";
      case "RANGE_BOUND":
        return "border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10";
      case "HIGH_VOLATILITY":
        return "border-[#A855F7]/40 text-[#A855F7] bg-[#A855F7]/10";
      case "LOW_ACTIVITY":
        return "border-[#71717A]/40 text-[#A1A1AA] bg-[#71717A]/10";
      default:
        return "border-[#3F3F46] text-[#D4D4D8] bg-[#27272A]/20";
    }
  };

  return (
    <div
      id="market-regime-card"
      className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] flex flex-col gap-2.5 font-mono select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#888] tracking-widest uppercase">
            MARKET REGIME
          </span>
          <span className="text-[#333] text-[10px]">·</span>
          <span className="text-[9px] text-[#555] tracking-wider uppercase">
            DETERMINISTIC
          </span>
        </div>
        <span
          id="market-regime-badge"
          className={`text-[10px] font-bold px-2 py-0.5 border tracking-wider uppercase ${getBadgeStyle(
            regime.regime,
          )}`}
        >
          {regime.regime.replace("_", " ")}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-[10px] bg-[#050505] p-2 border border-[#151515]">
        <div>
          <span className="text-[#555] block text-[9px]">ATR VOLATILITY</span>
          <span className="text-[#DDD] font-semibold">{regime.atr_pct}%</span>
        </div>
        <div>
          <span className="text-[#555] block text-[9px]">RVOL ACTIVITY</span>
          <span className="text-[#00E5FF] font-semibold">{regime.rvol}x</span>
        </div>
        <div>
          <span className="text-[#555] block text-[9px]">EMA TREND</span>
          <span className="text-[#AAA] font-semibold text-[9px]">
            {regime.ema_trend.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Explanatory Reasons Checklist */}
      <div className="flex flex-col gap-1 text-[10px]">
        <span className="text-[9px] text-[#555] tracking-wider uppercase font-semibold">
          EVIDENCE AUDIT:
        </span>
        <ul className="space-y-1">
          {regime.reasons.map((reason, idx) => (
            <li
              key={idx}
              className="text-[#999] leading-relaxed flex items-start gap-1.5 text-[10px]"
            >
              <span className="text-[#00E5FF] mt-0.5">›</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
