// src/components/MarketRegimeCard.tsx
// Deterministic market regime classifier — graphite-and-paper design system.

import type { MarketRegimeResponse } from "../types/structure";

interface Props {
  regime: MarketRegimeResponse | null;
  loading?: boolean;
}

type BadgeVariant = "accent" | "positive" | "negative" | "warning" | "neutral";

function getBadgeVariant(r: string): BadgeVariant {
  switch (r) {
    case "TRENDING_UP":    return "positive";
    case "TRENDING_DOWN":  return "negative";
    case "RANGE_BOUND":    return "warning";
    case "HIGH_VOLATILITY": return "accent";
    case "LOW_ACTIVITY":   return "neutral";
    default:               return "neutral";
  }
}

function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  const styles: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
    positive: { color: "var(--positive)", bg: "var(--positive-subtle)", border: "var(--positive-border)" },
    negative: { color: "var(--negative)", bg: "var(--negative-subtle)", border: "var(--negative-border)" },
    warning:  { color: "var(--warning)",  bg: "var(--warning-subtle)",  border: "var(--warning-border)"  },
    accent:   { color: "var(--accent)",   bg: "var(--accent-subtle)",   border: "var(--accent-border)"   },
    neutral:  { color: "var(--text-tertiary)", bg: "var(--neutral-subtle)", border: "var(--border-default)" },
  };
  const s = styles[variant];
  return (
    <span
      id="market-regime-badge"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        padding: "2px 7px",
        border: `1px solid ${s.border}`,
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-disabled)",
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 600,
        color: color ?? "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>
    </div>
  );
}

export default function MarketRegimeCard({ regime, loading }: Props) {
  if (loading && !regime) {
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
        Classifying market regime…
      </div>
    );
  }

  if (!regime) return null;

  const variant = getBadgeVariant(regime.regime);

  return (
    <div
      id="market-regime-card"
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
            Market Regime
          </span>
          <span style={{ color: "var(--border-default)", fontSize: 10 }}>·</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--text-disabled)",
            textTransform: "uppercase",
          }}>
            Deterministic
          </span>
        </div>
        <Badge label={regime.regime} variant={variant} />
      </div>

      {/* Metrics Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        padding: 10,
        backgroundColor: "var(--surface-inset)",
        border: "1px solid var(--border-subtle)",
      }}>
        <MetricCell label="ATR VOL" value={`${regime.atr_pct}%`} />
        <MetricCell label="RVOL" value={`${regime.rvol}x`} color="var(--accent)" />
        <MetricCell
          label="EMA TREND"
          value={regime.ema_trend.replace(/_/g, " ")}
          color="var(--text-secondary)"
        />
      </div>

      {/* Evidence Audit */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}>
          Evidence Audit
        </span>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {regime.reasons.map((reason, idx) => (
            <li
              key={idx}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 10,
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2, fontSize: 8 }}>›</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
