// src/components/xray/XRayMarketStructure.tsx
// Section 3: Deterministic Market Structure context.
// HH/HL/LH/LL trend sequence, support & resistance proximity, MA spreads, and RVOL telemetry.

import { Layers, Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { XRayMarketStructure as MarketStructureType } from "../../types/xray";

interface XRayMarketStructureProps {
  structure: MarketStructureType;
  currentClose: number;
}

export function XRayMarketStructure({ structure, currentClose }: XRayMarketStructureProps) {
  const { trend, trendLabel, swingHighCount, swingLowCount, nearestSupport, nearestResistance, ema9_ema20, sma50_sma200, volume } = structure;

  const isUptrend = trend === "HH_HL";
  const isDowntrend = trend === "LH_LL";

  return (
    <div className="bg-[#0D0D0D] border border-[#232323] p-4 flex flex-col gap-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]" style={{ fontFamily: "var(--font-mono)" }}>
            3. Market Structure Context
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#1E90FF] border border-[rgba(30,144,255,0.3)] bg-[rgba(30,144,255,0.08)] px-2 py-0.5 rounded-sm">
          POINT-IN-TIME
        </span>
      </div>

      {/* 1. Current Trend Sequence (HH/HL vs LH/LL) */}
      <div className="bg-[#05070B] border border-[#1A1A1A] p-3 rounded-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-sm flex items-center justify-center ${
              isUptrend
                ? "bg-[rgba(34,197,94,0.15)] text-[#22C55E]"
                : isDowntrend
                ? "bg-[rgba(239,68,68,0.15)] text-[#EF4444]"
                : "bg-[#161616] text-[#A0A0A8]"
            }`}
          >
            {isUptrend ? (
              <TrendingUp size={16} strokeWidth={2.5} />
            ) : isDowntrend ? (
              <TrendingDown size={16} strokeWidth={2.5} />
            ) : (
              <Layers size={16} strokeWidth={2} />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-[#FAFAFA]">{trendLabel}</span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-[2px] ${
                  isUptrend
                    ? "bg-[#22C55E]/20 text-[#22C55E]"
                    : isDowntrend
                    ? "bg-[#EF4444]/20 text-[#EF4444]"
                    : "bg-[#6B6B72]/20 text-[#A0A0A8]"
                }`}
              >
                {trend}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#6B6B72] mt-0.5">
              Detected Swings: {swingHighCount} Highs · {swingLowCount} Lows
            </span>
          </div>
        </div>
      </div>

      {/* 2. Support & Resistance Proximity */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {/* Nearest Support */}
        <div className="bg-[#080808] border border-[#1A1A1A] p-2.5 rounded-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-[#6B6B72]">
            <span>NEAREST SUPPORT</span>
            <span className="text-[#22C55E] flex items-center gap-0.5">
              <ArrowDownRight size={11} />
              BELOW
            </span>
          </div>

          {nearestSupport ? (
            <div className="mt-2">
              <div className="text-sm font-bold text-[#22C55E] tabular-nums">
                ₹{nearestSupport.price.toFixed(2)}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#A0A0A8] mt-1">
                <span>Dist: ₹{nearestSupport.distance.toFixed(2)}</span>
                <span className="text-[#22C55E] font-semibold">-{nearestSupport.distancePct}%</span>
              </div>
              <div className="text-[9px] text-[#6B6B72] mt-0.5">
                {nearestSupport.touches} touches · str {nearestSupport.strength}/10
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#6B6B72] py-2">No active zone below</div>
          )}
        </div>

        {/* Nearest Resistance */}
        <div className="bg-[#080808] border border-[#1A1A1A] p-2.5 rounded-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-[#6B6B72]">
            <span>NEAREST RESISTANCE</span>
            <span className="text-[#EF4444] flex items-center gap-0.5">
              <ArrowUpRight size={11} />
              ABOVE
            </span>
          </div>

          {nearestResistance ? (
            <div className="mt-2">
              <div className="text-sm font-bold text-[#EF4444] tabular-nums">
                ₹{nearestResistance.price.toFixed(2)}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#A0A0A8] mt-1">
                <span>Dist: ₹{nearestResistance.distance.toFixed(2)}</span>
                <span className="text-[#EF4444] font-semibold">+{nearestResistance.distancePct}%</span>
              </div>
              <div className="text-[9px] text-[#6B6B72] mt-0.5">
                {nearestResistance.touches} touches · str {nearestResistance.strength}/10
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#6B6B72] py-2">Blue sky / no ceiling</div>
          )}
        </div>
      </div>

      {/* 3. Moving Average Relationships */}
      <div className="flex flex-col gap-2 bg-[#05070B] border border-[#1A1A1A] p-2.5 rounded-sm text-xs font-mono">
        <div className="text-[10px] text-[#6B6B72] uppercase">Moving Average Confluence</div>

        {/* EMA 9 / EMA 20 */}
        <div className="flex items-center justify-between border-b border-[#161616] pb-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#FAFAFA]">EMA 9 / EMA 20 Relationship</span>
            <span className="text-[10px] text-[#A0A0A8]">{ema9_ema20.relationship}</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-[#1E90FF] font-bold tabular-nums">
              {ema9_ema20.ema9 ? `₹${ema9_ema20.ema9}` : "---"} / {ema9_ema20.ema20 ? `₹${ema9_ema20.ema20}` : "---"}
            </span>
            <span
              className={`block text-[10px] font-semibold ${
                ema9_ema20.isBullishStack ? "text-[#22C55E]" : "text-[#EF4444]"
              }`}
            >
              Spread: {ema9_ema20.spreadPct > 0 ? "+" : ""}
              {ema9_ema20.spreadPct}%
            </span>
          </div>
        </div>

        {/* SMA 50 / SMA 200 */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#FAFAFA]">SMA 50 / SMA 200 Relationship</span>
            <span className="text-[10px] text-[#A0A0A8]">{sma50_sma200.relationship}</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-[#FAFAFA] font-bold tabular-nums">
              {sma50_sma200.sma50 ? `₹${sma50_sma200.sma50}` : "---"} / {sma50_sma200.sma200 ? `₹${sma50_sma200.sma200}` : "---"}
            </span>
            <span
              className={`block text-[10px] font-semibold ${
                sma50_sma200.isGoldenCross ? "text-[#22C55E]" : "text-[#EF4444]"
              }`}
            >
              Spread: {sma50_sma200.spreadPct > 0 ? "+" : ""}
              {sma50_sma200.spreadPct}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Volume & RVOL (Relative Volume) */}
      <div className="bg-[#080808] border border-[#1A1A1A] p-2.5 rounded-sm flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Activity size={15} className={volume.isVolumeSpike ? "text-[#1E90FF]" : "text-[#A0A0A8]"} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#FAFAFA]">
                RVOL {volume.rvol}x
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-[2px] ${
                  volume.isVolumeSpike
                    ? "bg-[#1E90FF]/20 text-[#1E90FF]"
                    : volume.volumeState === "ELEVATED"
                    ? "bg-[#22C55E]/20 text-[#22C55E]"
                    : "bg-[#161616] text-[#6B6B72]"
                }`}
              >
                {volume.volumeState}
              </span>
            </div>
            <span className="text-[10px] text-[#6B6B72]">
              Flow: <strong className="text-[#A0A0A8] font-normal">{volume.relationship}</strong>
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-bold text-[#FAFAFA] tabular-nums">
            {(volume.currentVolume / 1e5).toFixed(2)}L
          </div>
          <span className="text-[10px] text-[#6B6B72]">
            Base: {(volume.baselineAvg / 1e5).toFixed(2)}L
          </span>
        </div>
      </div>
    </div>
  );
}
