// dashboard/src/components/FuzzyExplainCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Xeroww Mamdani Fuzzy Explainability Engine — Institutional UI Component
//
// Renders the FuzzyExplainabilityReport as a premium SRE-grade telemetry card
// in the Market Structure sidebar panel.
//
// Design language: pitch-black canvas, institutional typography,
// gradient activation bars, expandable rule accordions, staggered animations.
//
// NOT a buy/sell signal display. NOT ML output. Pure linguistic audit trail.

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Zap,
  BarChart3,
  TrendingUp,
  Layers,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type {
  FuzzyExplainabilityReport,
  FuzzyDimension,
  FiredRule,
  DimensionName,
  OverallLabel,
} from "../types/fuzzy";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FuzzyExplainCardProps {
  report: FuzzyExplainabilityReport | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// ---------------------------------------------------------------------------
// Color + label helpers
// ---------------------------------------------------------------------------

const OVERALL_COLORS: Record<string, string> = {
  STRONGLY_BULLISH:   "#22C55E",
  MODERATELY_BULLISH: "#4ADE80",
  NEUTRAL:            "#94A3B8",
  MODERATELY_BEARISH: "#F59E0B",
  STRONGLY_BEARISH:   "#EF4444",
  INSUFFICIENT_DATA:  "#64748B",
};

const DIMENSION_LABEL_COLORS: Record<string, string> = {
  // Momentum
  SURGING:  "#22C55E",
  STRONG:   "#4ADE80",
  MODERATE: "#60A5FA",
  WEAK:     "#F59E0B",
  // Volume
  CLIMACTIC: "#A78BFA",
  ELEVATED:  "#60A5FA",
  NORMAL:    "#94A3B8",
  DRY:       "#F59E0B",
  // Trend
  STRONGLY_BULLISH: "#22C55E",
  BULLISH:   "#4ADE80",
  NEUTRAL_T: "#94A3B8",
  BEARISH:   "#F87171",
  // Structure
  DOMINANT:  "#22C55E",
  FIRM:      "#60A5FA",
  CONTESTED: "#F59E0B",
  BROKEN:    "#EF4444",
};

function labelColor(label: string): string {
  return DIMENSION_LABEL_COLORS[label] ?? "#94A3B8";
}

function overallColor(label: OverallLabel): string {
  return OVERALL_COLORS[label] ?? "#94A3B8";
}

// ---------------------------------------------------------------------------
// Dimension metadata
// ---------------------------------------------------------------------------

const DIMENSION_META: Record<DimensionName, {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  inputKey1: string;
  inputKey2: string;
}> = {
  momentum: {
    icon: <Zap size={12} />,
    title: "MOMENTUM",
    subtitle: "EMA-9 × EMA-20 spread",
    inputKey1: "ema_spread_pct",
    inputKey2: "price_vs_ema20_pct",
  },
  volume: {
    icon: <BarChart3 size={12} />,
    title: "VOLUME",
    subtitle: "RVOL × 5d volume trend",
    inputKey1: "rvol",
    inputKey2: "volume_trend_pct",
  },
  trend: {
    icon: <TrendingUp size={12} />,
    title: "TREND",
    subtitle: "SMA-200 position × alignment",
    inputKey1: "price_vs_sma200_pct",
    inputKey2: "alignment_score",
  },
  structure: {
    icon: <Layers size={12} />,
    title: "STRUCTURE",
    subtitle: "SR proximity × regime strength",
    inputKey1: "zone_proximity_pct",
    inputKey2: "regime_strength",
  },
};

// ---------------------------------------------------------------------------
// Animated activation bar sub-component
// ---------------------------------------------------------------------------

interface ActivationBarProps {
  activation: number;   // 0.0–1.0
  color: string;
  delay?: number;       // ms for stagger animation
  height?: number;
}

function ActivationBar({ activation, color, delay = 0, height = 4 }: ActivationBarProps) {
  const [width, setWidth] = useState(0);
  const ref = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setWidth(0);
    ref.current = setTimeout(() => {
      setWidth(Math.round(activation * 100));
    }, delay + 80);
    return () => clearTimeout(ref.current);
  }, [activation, delay]);

  const pct = Math.max(0, Math.min(100, width));

  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height, background: "#0D1117" }}
    >
      <div
        className="rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          height,
          background: `linear-gradient(90deg, #1E90FF 0%, ${color} 100%)`,
          boxShadow: pct > 0 ? `0 0 6px ${color}44` : "none",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Membership activations mini-bar list
// ---------------------------------------------------------------------------

interface MembershipBarListProps {
  activations: FuzzyDimension["activations"];
}

function MembershipBarList({ activations }: MembershipBarListProps) {
  const top = activations.slice(0, 5); // top-5 terms
  return (
    <div className="space-y-1.5">
      {top.map((a) => (
        <div key={a.term} className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-[#64748B] w-24 shrink-0 truncate">
            {a.term}
          </span>
          <div className="flex-1 bg-[#0D1117] rounded-full overflow-hidden" style={{ height: 3 }}>
            <div
              className="rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(a.value * 100)}%`,
                height: 3,
                background: a.value > 0.5 ? "#1E90FF" : "#334155",
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-[#475569] w-8 text-right shrink-0">
            {a.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fired Rules accordion
// ---------------------------------------------------------------------------

interface FiredRulesListProps {
  rules: ReadonlyArray<FiredRule>;
}

function FiredRulesList({ rules }: FiredRulesListProps) {
  const top = rules.slice(0, 6);
  return (
    <div className="space-y-1.5">
      {top.map((rule, i) => (
        <div
          key={i}
          className={`p-2 rounded border text-[9px] font-mono ${
            rule.fired
              ? "border-[#1E2538] bg-[#080B10]"
              : "border-[#0D1117] bg-[#05070B] opacity-50"
          }`}
        >
          <div className="flex items-start gap-1.5">
            <span
              className={`mt-0.5 shrink-0 text-[8px] font-bold ${
                rule.fired ? "text-[#22C55E]" : "text-[#334155]"
              }`}
            >
              {rule.fired ? "✓" : "○"}
            </span>
            <div className="min-w-0">
              <div className="text-[#94A3B8] leading-tight break-all">
                {rule.description}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[#475569]">→</span>
                <span
                  className="font-semibold"
                  style={{ color: labelColor(rule.consequent_term) }}
                >
                  {rule.consequent_term}
                </span>
                <span className="text-[#334155]">
                  strength={rule.activation.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Dimension Row
// ---------------------------------------------------------------------------

interface DimensionRowProps {
  dimension: FuzzyDimension;
  index: number;
}

function DimensionRow({ dimension, index }: DimensionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = DIMENSION_META[dimension.name as DimensionName];
  const color = labelColor(dimension.label);
  const pct = Math.round(dimension.activation * 100);

  return (
    <div className="border border-[#1A1F2E] rounded overflow-hidden">
      {/* Row header — always visible */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#080B10] transition-colors group"
        aria-expanded={expanded}
      >
        {/* Dimension icon + name */}
        <div
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
        >
          {meta?.icon}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest text-[#94A3B8]">
              {meta?.title ?? dimension.name.toUpperCase()}
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
              style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
            >
              {dimension.label}
            </span>
          </div>
          {/* Activation bar */}
          <div className="mt-1.5">
            <ActivationBar activation={dimension.activation} color={color} delay={index * 80} />
          </div>
        </div>

        {/* Activation score */}
        <div className="text-right shrink-0">
          <span className="text-[11px] font-bold font-mono" style={{ color }}>
            {pct}%
          </span>
        </div>

        {/* Chevron */}
        <div className="text-[#334155] group-hover:text-[#64748B] shrink-0 transition-colors">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#1A1F2E] bg-[#030508] px-3 py-3 space-y-4">
          {/* Narrative */}
          <p className="text-[10px] text-[#64748B] leading-relaxed font-mono">
            {dimension.narrative}
          </p>

          {/* Raw inputs */}
          <div>
            <div className="text-[9px] text-[#475569] font-mono tracking-widest mb-1.5 uppercase">
              Crisp Inputs
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(dimension.inputs).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-[#080B10] border border-[#1A1F2E] rounded px-2 py-1.5"
                >
                  <div className="text-[8px] text-[#475569] font-mono truncate">{k}</div>
                  <div className="text-[11px] font-mono font-bold text-[#E2E8F0] mt-0.5">
                    {typeof v === "number" ? v.toFixed(4) : v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Membership activations */}
          <div>
            <div className="text-[9px] text-[#475569] font-mono tracking-widest mb-2 uppercase">
              Membership Activations (primary variable)
            </div>
            <MembershipBarList activations={dimension.activations} />
          </div>

          {/* Fired rules */}
          <div>
            <div className="text-[9px] text-[#475569] font-mono tracking-widest mb-2 uppercase">
              Mamdani Rules Evaluated
            </div>
            <FiredRulesList rules={dimension.fired_rules} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overall Composite Badge
// ---------------------------------------------------------------------------

interface OverallBadgeProps {
  label: OverallLabel;
  activation: number;
}

function OverallBadge({ label, activation }: OverallBadgeProps) {
  const color = overallColor(label);
  const pct = Math.round(activation * 100);

  return (
    <div
      className="p-3 rounded border"
      style={{ background: `${color}08`, border: `1px solid ${color}28` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: color }}
          />
          <span className="text-[9px] font-mono tracking-widest text-[#64748B]">
            COMPOSITE ASSESSMENT
          </span>
        </div>
        <span className="text-[9px] font-mono text-[#334155]">
          {pct}% activation
        </span>
      </div>
      <div className="font-bold tracking-widest text-sm" style={{ color }}>
        {label.replace(/_/g, " ")}
      </div>
      <div className="mt-2">
        <ActivationBar activation={activation} color={color} delay={0} height={5} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FuzzyExplainCard Component
// ---------------------------------------------------------------------------

export function FuzzyExplainCard({
  report,
  loading = false,
  error = null,
  onRefresh,
}: FuzzyExplainCardProps) {
  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="bg-[#05070B] border border-[#1E2538] rounded p-4 flex flex-col items-center gap-3">
        <Loader2 size={16} className="text-[#1E90FF] animate-spin" />
        <div className="text-[10px] font-mono text-[#475569] text-center">
          RUNNING MAMDANI FIS INFERENCE…
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="bg-[#05070B] border border-[#EF4444]/30 rounded p-3 flex items-start gap-2">
        <AlertCircle size={13} className="text-[#EF4444] shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-[#EF4444] font-mono">
            FUZZY ENGINE ERROR
          </div>
          <div className="text-[9px] text-[#64748B] font-mono mt-1 break-all">{error}</div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 text-[9px] font-mono text-[#1E90FF] hover:text-[#60A5FA] flex items-center gap-1"
            >
              <RefreshCw size={10} /> retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No data
  // ---------------------------------------------------------------------------
  if (!report) {
    return (
      <div className="bg-[#05070B] border border-[#1E2538] rounded p-3">
        <div className="text-[10px] font-mono text-[#334155] text-center">
          Select a symbol to run Fuzzy Inference
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Report render
  // ---------------------------------------------------------------------------
  const hasDimensions = report.dimensions.length > 0;
  const computedAgo = (() => {
    try {
      const delta = Math.round((Date.now() - new Date(report.computed_at).getTime()) / 1000);
      return delta < 60 ? `${delta}s ago` : `${Math.round(delta / 60)}m ago`;
    } catch {
      return "just now";
    }
  })();

  return (
    <div className="bg-[#000000] border border-[#1E2538] rounded overflow-hidden select-none">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E2538] bg-[#03050A]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-[#1E90FF]/10 border border-[#1E90FF]/25 text-[#1E90FF]">
            <Brain size={11} />
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#E2E8F0]">
              FUZZY EXPLAINABILITY ENGINE
            </div>
            <div className="text-[8px] font-mono text-[#334155]">
              {report.symbol} · computed {computedAgo} · {report.computation_ms}ms
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[8px] font-mono px-1.5 py-0.5 bg-[#0D1117] border border-[#1A1F2E] text-[#475569] rounded-sm">
            Mamdani FIS
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-[#334155] hover:text-[#64748B] transition-colors"
              title="Refresh fuzzy inference"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* ── Overall composite ──────────────────────────────────────────────── */}
        {hasDimensions && (
          <OverallBadge
            label={report.overall_label}
            activation={report.overall_activation}
          />
        )}

        {/* ── Insufficient data ──────────────────────────────────────────────── */}
        {!hasDimensions && (
          <div className="text-[10px] font-mono text-[#475569] text-center py-2">
            {report.overall_label === "INSUFFICIENT_DATA"
              ? "Insufficient candle history (min 20 bars required)"
              : "No FIS dimensions computed"}
          </div>
        )}

        {/* ── Dimension rows ─────────────────────────────────────────────────── */}
        {hasDimensions && (
          <div className="space-y-1.5">
            {report.dimensions.map((dim, i) => (
              <DimensionRow key={dim.name} dimension={dim} index={i} />
            ))}
          </div>
        )}

        {/* ── Methodology disclaimer ─────────────────────────────────────────── */}
        <div className="border-t border-[#1A1F2E] pt-2.5">
          <p className="text-[8px] font-mono text-[#334155] leading-relaxed">
            ⚠ {report.methodology_note}
          </p>
        </div>

        {/* ── Dimension weights footnote ──────────────────────────────────────── */}
        <div className="text-[8px] font-mono text-[#1E2538] leading-relaxed">
          Weights: Trend 35% · Momentum 30% · Volume 20% · Structure 15%
        </div>
      </div>
    </div>
  );
}

export default FuzzyExplainCard;
