// src/components/VolumeAnalyticsPanel.tsx
// Institutional Volume Profile & RVOL Analytics — graphite-and-paper design system.

import type { VolumeAnalyticsResponse } from "../types/structure";

interface Props {
  volume: VolumeAnalyticsResponse | null;
  loading?: boolean;
}

type BadgeVariant = "accent" | "positive" | "negative" | "warning" | "neutral";

function getVolBadge(state: string): BadgeVariant {
  switch (state) {
    case "ELEVATED": return "accent";
    case "UNUSUALLY_LOW": return "neutral";
    default: return "neutral";
  }
}

function getPvRelStyle(rel: string): string {
  switch (rel) {
    case "ACCUMULATION": return "var(--positive)";
    case "DISTRIBUTION": return "var(--negative)";
    case "LOW_VOLUME_PULLBACK": return "var(--warning)";
    default: return "var(--text-tertiary)";
  }
}

export default function VolumeAnalyticsPanel({ volume, loading }: Props) {
  if (loading && !volume) {
    return (
      <div style={{
        padding: 12,
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.08em",
        color: "var(--text-disabled)",
        textTransform: "uppercase",
      }}>
        Calculating volume RVOL…
      </div>
    );
  }

  if (!volume) return null;

  const badgeVariant = getVolBadge(volume.volume_state);
  const badgeStyles: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
    accent:   { color: "var(--accent)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
    positive: { color: "var(--positive)", bg: "var(--positive-subtle)", border: "var(--positive-border)" },
    negative: { color: "var(--negative)", bg: "var(--negative-subtle)", border: "var(--negative-border)" },
    warning:  { color: "var(--warning)", bg: "var(--warning-subtle)", border: "var(--warning-border)" },
    neutral:  { color: "var(--text-tertiary)", bg: "var(--neutral-subtle)", border: "var(--border-default)" },
  };
  const bs = badgeStyles[badgeVariant];

  return (
    <div
      id="volume-analytics-panel"
      style={{
        padding: 12,
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        userSelect: "none",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 8,
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}>
            Volume Engine
          </span>
          <span style={{ color: "var(--border-default)", fontSize: 10 }}>·</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--text-disabled)",
            textTransform: "uppercase",
          }}>
            RVOL
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {volume.is_volume_spike && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              fontWeight: 600,
              padding: "2px 6px",
              border: "1px solid var(--warning-border)",
              backgroundColor: "var(--warning-subtle)",
              color: "var(--warning)",
              letterSpacing: "0.08em",
            }}>
              SPIKE ≥2×
            </span>
          )}
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "2px 7px",
            border: `1px solid ${bs.border}`,
            backgroundColor: bs.bg,
            color: bs.color,
          }}>
            {volume.volume_state}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        padding: 10,
        backgroundColor: "var(--surface-inset)",
        border: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
            RVOL Ratio
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--accent)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {volume.rvol}×
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
            20D Avg
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {volume.baseline_avg_volume.toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
            P/V Dynamic
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            color: getPvRelStyle(volume.price_volume_relationship),
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
            {volume.price_volume_relationship.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Flags */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {volume.breakout_confirmed && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            color: "var(--positive)",
          }}>
            <span style={{ fontSize: 10 }}>✓</span>
            <span>Volume confirms 10-session price breakout</span>
          </div>
        )}
        {volume.divergence_flag && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            color: "var(--warning)",
          }}>
            <span style={{ fontSize: 10 }}>⚠</span>
            <span>{volume.divergence_flag}</span>
          </div>
        )}
        <p style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          lineHeight: 1.6,
          color: "var(--text-tertiary)",
          margin: 0,
        }}>
          {volume.explanation}
        </p>
      </div>
    </div>
  );
}
