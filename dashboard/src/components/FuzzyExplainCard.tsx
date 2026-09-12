// src/components/FuzzyExplainCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Xeroww Market Context Engine — Institutional UI Component
//
// Interprets market state using Mamdani Fuzzy Inference across 4 dimensions:
// Momentum, Volume, Trend, and Structure.
//
// Stylized with v2 composable primitives (Panel, PanelHeader, Badge, Metric, Progress, Skeleton)
// to match the exact institutional aesthetic of MarketRegimeCard and SignalAlignmentCard.
//
// NOT a buy/sell signal. NOT ML. Pure deterministic linguistic audit trail.

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sliders,
} from "lucide-react";
import type {
  FuzzyExplainabilityReport,
  FuzzyDimension,
  DimensionName,
  OverallLabel,
} from "../types/fuzzy";
import { Panel, PanelHeader, Badge, Metric, Progress, Skeleton } from "./ui";

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
// Variant & Color Mapping for UI Primitives
// ---------------------------------------------------------------------------

function getOverallBadgeVariant(label: OverallLabel): "green" | "red" | "amber" | "blue" | "neutral" {
  switch (label) {
    case "STRONGLY_BULLISH":
    case "MODERATELY_BULLISH":
      return "green";
    case "STRONGLY_BEARISH":
    case "MODERATELY_BEARISH":
      return "red";
    case "NEUTRAL":
      return "neutral";
    case "INSUFFICIENT_DATA":
      return "neutral";
    default:
      return "blue";
  }
}

function getOverallAccentEdge(label: OverallLabel): "positive" | "negative" | "primary" | "none" {
  switch (label) {
    case "STRONGLY_BULLISH":
    case "MODERATELY_BULLISH":
      return "positive";
    case "STRONGLY_BEARISH":
    case "MODERATELY_BEARISH":
      return "negative";
    case "NEUTRAL":
      return "none";
    default:
      return "primary";
  }
}

function getDimensionBadgeVariant(
  dimName: DimensionName,
  label: string
): "green" | "red" | "amber" | "blue" | "neutral" {
  switch (dimName) {
    case "momentum":
      if (label === "SURGING" || label === "STRONG") return "green";
      if (label === "MODERATE") return "blue";
      return "amber"; // WEAK

    case "volume":
      if (label === "CLIMACTIC" || label === "ELEVATED") return "blue";
      if (label === "NORMAL") return "neutral";
      return "amber"; // DRY

    case "trend":
      if (label === "STRONGLY_BULLISH" || label === "BULLISH") return "green";
      if (label === "BEARISH") return "red";
      return "neutral"; // NEUTRAL_T

    case "structure":
      if (label === "DOMINANT") return "green";
      if (label === "FIRM") return "blue";
      if (label === "CONTESTED") return "amber";
      return "red"; // BROKEN

    default:
      return "neutral";
  }
}

function getProgressColor(
  variant: "green" | "red" | "amber" | "blue" | "neutral"
): "green" | "red" | "amber" | "blue" {
  if (variant === "neutral") return "blue";
  return variant;
}

const DIMENSION_DISPLAY_TITLES: Record<DimensionName, { title: string; subtitle: string }> = {
  momentum: { title: "Momentum", subtitle: "EMA-9 × EMA-20 spread" },
  volume:   { title: "Volume",   subtitle: "RVOL × 5-day volume trend" },
  trend:    { title: "Trend",    subtitle: "SMA-200 position × signal alignment" },
  structure:{ title: "Structure",subtitle: "SR proximity × regime strength" },
};

// ---------------------------------------------------------------------------
// Single Dimension Row
// ---------------------------------------------------------------------------

function DimensionItem({
  dimension,
}: {
  dimension: FuzzyDimension;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const dimName = dimension.name as DimensionName;
  const meta = DIMENSION_DISPLAY_TITLES[dimName] ?? {
    title: dimension.name.toUpperCase(),
    subtitle: "",
  };

  const badgeVariant = getDimensionBadgeVariant(dimName, dimension.label);
  const progressColor = getProgressColor(badgeVariant);
  const pct = Math.round(dimension.activation * 100);

  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--surface-inset)] transition-colors">
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full p-2.5 flex items-center justify-between text-left hover:bg-[var(--surface-overlay)] transition-colors duration-150 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {meta.title}
              </span>
              <Badge variant={badgeVariant} size="sm">
                {dimension.label.replace(/_/g, " ")}
              </Badge>
            </div>
            <span className="text-[10px] text-[var(--text-tertiary)] truncate">
              {meta.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-16 hidden sm:block">
            <Progress value={pct} max={100} color={progressColor} height={4} />
          </div>
          <span className="text-xs font-mono font-bold text-[var(--text-primary)] tabular-nums">
            {pct}%
          </span>
          <span className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </div>
      </button>

      {/* Mini-progress bar on mobile */}
      <div className="px-2.5 pb-1 sm:hidden">
        <Progress value={pct} max={100} color={progressColor} height={3} />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-3">
          {/* Narrative */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
            {dimension.narrative}
          </p>

          {/* Crisp Inputs */}
          <div>
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Calculated Crisp Inputs
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(dimension.inputs).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-[var(--surface-inset)] border border-[var(--border-subtle)] p-2"
                >
                  <div className="text-[9px] font-mono text-[var(--text-tertiary)] truncate">
                    {k.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs font-mono font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">
                    {typeof v === "number" ? v.toFixed(2) : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Membership Activations */}
          <div>
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Fuzzy Membership Spread
            </div>
            <div className="space-y-1">
              {dimension.activations.map((a) => (
                <div key={a.term} className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[var(--text-secondary)] truncate w-32">
                    {a.term.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 mx-2">
                    <Progress
                      value={Math.round(a.value * 100)}
                      max={100}
                      color={a.value > 0.5 ? "blue" : "neutral" as any}
                      height={3}
                    />
                  </div>
                  <span className="text-[var(--text-tertiary)] w-8 text-right tabular-nums">
                    {a.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fired Rules Audit */}
          {dimension.fired_rules.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                Active Inference Rules
              </div>
              <div className="space-y-1.5">
                {dimension.fired_rules.slice(0, 4).map((rule, idx) => (
                  <div
                    key={idx}
                    className={`p-2 border text-xs leading-relaxed flex items-start gap-2 ${
                      rule.fired
                        ? "bg-[var(--surface-inset)] border-[var(--border-default)]"
                        : "bg-transparent border-[var(--border-subtle)] opacity-40"
                    }`}
                  >
                    <span className={`text-xs font-bold shrink-0 mt-0.5 ${rule.fired ? "text-[var(--positive)]" : "text-[var(--text-tertiary)]"}`}>
                      {rule.fired ? "✓" : "○"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--text-secondary)] text-[11px]">
                        {rule.description}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                        <span className="text-[var(--text-tertiary)]">THEN →</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {rule.consequent_term}
                        </span>
                        <span className="text-[var(--text-tertiary)]">
                          (strength: {rule.activation.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
  // Loading state (Matches Panel style of other sidebar cards)
  // ---------------------------------------------------------------------------
  if (loading && !report) {
    return (
      <Panel id="market-context-loading" className="overflow-hidden">
        <PanelHeader
          title="Market Context"
          subtitle="Synthesizing momentum, volume, trend & structure…"
          badge={<Badge variant="outline" dot>Computing</Badge>}
        />
        <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-2">
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </div>
        <div className="p-3 space-y-2">
          <Skeleton height={38} />
          <Skeleton height={38} />
          <Skeleton height={38} />
        </div>
      </Panel>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error && !report) {
    return (
      <Panel id="market-context-error" accentEdge="negative" className="overflow-hidden p-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--negative)]">
              Context Evaluation Error
            </span>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 mb-0 leading-relaxed">
              {error}
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs text-[var(--accent-primary)] hover:text-[var(--text-primary)] flex items-center gap-1 shrink-0 ml-2"
            >
              <RefreshCw size={10} /> Retry
            </button>
          )}
        </div>
      </Panel>
    );
  }

  // ---------------------------------------------------------------------------
  // Idle / No data
  // ---------------------------------------------------------------------------
  if (!report) {
    return (
      <Panel className="p-3 text-center">
        <span className="text-xs text-[var(--text-tertiary)]">
          Select a symbol to evaluate market context
        </span>
      </Panel>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Populated Report
  // ---------------------------------------------------------------------------
  const overallLabel = report.overall_label;
  const badgeVariant = getOverallBadgeVariant(overallLabel);
  const accentEdge = getOverallAccentEdge(overallLabel);
  const totalFired = report.dimensions.reduce(
    (sum, d) => sum + d.fired_rules.filter((r) => r.fired).length,
    0
  );

  return (
    <Panel id="market-context-card" accentEdge={accentEdge} className="overflow-hidden">
      {/* Panel Header matching other sidebar cards */}
      <PanelHeader
        title="Market Context"
        subtitle={`Multi-factor synthesis · ${report.symbol}`}
        badge={
          <Badge variant={badgeVariant} dot>
            {overallLabel.replace(/_/g, " ")}
          </Badge>
        }
        action={
          onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-0.5"
              title="Refresh context inference"
            >
              <RefreshCw size={11} />
            </button>
          )
        }
      />

      {/* Inset Metrics Row matching MarketRegimeCard / SignalAlignmentCard */}
      <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-2">
        <Metric
          label="Conviction"
          value={`${Math.round(report.overall_activation * 100)}%`}
          size="sm"
        />
        <Metric
          label="Dominant Bias"
          value={overallLabel.replace(/_/g, " ")}
          size="sm"
        />
        <Metric
          label="Active Rules"
          value={`${totalFired} fired`}
          size="sm"
        />
      </div>

      {/* Dimensions Body */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
          <span>Context Dimensions</span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
            Click to expand audit
          </span>
        </div>

        <div className="space-y-1.5">
          {report.dimensions.map((dim, idx) => (
            <DimensionItem key={dim.name} dimension={dim} index={idx} />
          ))}
        </div>

        {/* Methodology Footer */}
        <div className="pt-2 mt-1 border-t border-[var(--border-subtle)] flex items-start gap-1.5">
          <Sliders size={11} className="text-[var(--text-tertiary)] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed m-0">
            Deterministic Mamdani inference synthesizing momentum (30%), volume (20%), trend (35%), and structure (15%). Read-only interpretability layer.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export default FuzzyExplainCard;
