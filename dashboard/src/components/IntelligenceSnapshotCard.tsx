import type { MarketStructureSummaryResponse } from "../types/structure";
import { Surface } from "./ui";

export default function IntelligenceSnapshotCard({ structure }: { structure: MarketStructureSummaryResponse }) {
  const pattern = structure.detected_patterns[0];
  const alignment = structure.signal_alignment;
  const leadingCount = Math.max(alignment.bullish_alignment_count, alignment.bearish_alignment_count);
  const alignmentPct = Math.round((leadingCount / Math.max(1, alignment.alignment_total)) * 100);
  const resistance = structure.support_resistance.nearest_resistance;
  const signal = alignment.dominant_bias.replace(/_CONFLUENCE|_MIXED/g, "").replace(/_/g, " ");
  const patternLabel = pattern?.pattern.replace(/_/g, " ") ?? "None detected";
  const interpretation = pattern
    ? `${patternLabel} detected. ${leadingCount} of ${alignment.alignment_total} conditions align with the leading side.`
    : `${leadingCount} of ${alignment.alignment_total} conditions align with the leading side. Review the full evidence for context.`;
  const metrics = [
    { label: "Signal", value: signal },
    { label: "Pattern", value: patternLabel },
    { label: "Alignment", value: `${alignmentPct}%` },
    { label: "RVOL", value: `${structure.volume.rvol.toFixed(2)}×` },
    { label: "Regime", value: structure.market_regime.regime.replace(/_/g, " ") },
    { label: "Resistance", value: resistance ? `₹${resistance.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Not nearby" },
  ];

  return <Surface className="intelligence-snapshot" aria-label="Market intelligence snapshot">
    <header><h2>Signal snapshot</h2><span>Latest observed session</span></header>
    <dl>{metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd title={metric.value}>{metric.value}</dd></div>)}</dl>
    <p>{interpretation}</p>
  </Surface>;
}
