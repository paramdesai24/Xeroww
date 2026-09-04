// src/components/PatternCard.tsx
// Right panel — Marubozu detection result and Latest Candle Summary.

import { Zap, Eye, BookOpen, ShieldAlert, Minus } from "lucide-react";
import type { PatternData } from "../types/market";

interface PatternCardProps {
  pattern: PatternData | null;
}

const PATTERN_CONFIG = {
  bullish_marubozu: {
    label: "Bullish Marubozu",
    color: "emerald",
    badgeBg: "bg-emerald-500/10 border-emerald-500/30",
    badgeText: "text-emerald-400",
    dotColor: "bg-emerald-400",
    icon: "🟢",
  },
  bearish_marubozu: {
    label: "Bearish Marubozu",
    color: "red",
    badgeBg: "bg-red-500/10 border-red-500/30",
    badgeText: "text-red-400",
    dotColor: "bg-red-400",
    icon: "🔴",
  },
  none: {
    label: "No Pattern",
    color: "slate",
    badgeBg: "bg-slate-700/40 border-slate-700",
    badgeText: "text-slate-400",
    dotColor: "bg-slate-500",
    icon: "⚪",
  },
};

export default function PatternCard({ pattern }: PatternCardProps) {
  if (!pattern) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-violet-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Pattern Detection
          </h3>
        </div>
        <div className="py-6 text-center text-slate-600 text-sm">No data available</div>
      </div>
    );
  }

  const config = PATTERN_CONFIG[pattern.pattern];
  const candle = pattern.latest_candle;

  const directionColor =
    candle.direction === "bullish"
      ? "text-emerald-400"
      : candle.direction === "bearish"
        ? "text-red-400"
        : "text-slate-400";

  return (
    <div className="space-y-3">
      {/* Pattern Detection Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-violet-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Pattern Detection
          </h3>
        </div>

        {/* Pattern Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${config.badgeBg} ${config.badgeText} mb-3`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${pattern.pattern !== "none" ? "animate-pulse" : ""}`} />
          {config.icon} {config.label}
        </div>

        {/* Signal day */}
        {pattern.signal_day && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <Eye size={11} />
            <span>Signal detected: {pattern.signal_day}</span>
          </div>
        )}

        {/* Varsity Action */}
        <div className="bg-slate-900/60 rounded-lg p-3 mb-3 border border-slate-800/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BookOpen size={11} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
              Varsity Textbook Action
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{pattern.rationale}</p>
        </div>

        {/* Stop Loss */}
        {pattern.stop_loss !== null && (
          <div className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-red-400" />
              <span className="text-xs text-red-400 font-medium">Stop Loss</span>
            </div>
            <span className="text-sm font-bold text-red-300 tabular-nums">
              ₹{pattern.stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* No pattern note */}
        {pattern.pattern === "none" && (
          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
            <Minus size={11} />
            <span>{pattern.textbook_action.replace(/_/g, " ")}</span>
          </div>
        )}
      </div>

      {/* Latest Candle Summary Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Latest Candle · {candle.date}
          </span>
        </div>

        {/* Direction badge */}
        <div className={`inline-flex items-center gap-1.5 text-xs font-bold mb-3 ${directionColor}`}>
          <span className={`w-2 h-2 rounded-sm ${
            candle.direction === "bullish" ? "bg-emerald-400" :
            candle.direction === "bearish" ? "bg-red-400" : "bg-slate-400"
          }`} />
          {candle.direction.charAt(0).toUpperCase() + candle.direction.slice(1)} Session
        </div>

        {/* Candle metrics */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/50">
            <p className="text-[10px] text-slate-600 mb-0.5">Body %</p>
            <p className="text-sm font-bold text-slate-100 tabular-nums">{candle.body_pct.toFixed(1)}%</p>
            <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  candle.direction === "bullish" ? "bg-emerald-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(candle.body_pct, 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/50">
            <p className="text-[10px] text-slate-600 mb-0.5">Range %</p>
            <p className="text-sm font-bold text-slate-100 tabular-nums">{candle.range_pct.toFixed(2)}%</p>
            <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(candle.range_pct * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* OHLC mini grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {[
            { l: "Open", v: candle.open },
            { l: "Close", v: candle.close },
            { l: "High", v: candle.high },
            { l: "Low", v: candle.low },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center justify-between">
              <span className="text-slate-600">{l}</span>
              <span className="text-slate-300 font-medium tabular-nums">
                ₹{v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
