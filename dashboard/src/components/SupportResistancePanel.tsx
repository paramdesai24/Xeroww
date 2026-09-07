// src/components/SupportResistancePanel.tsx
// Institutional Support & Resistance Zones — graphite-and-paper design system.

import type { SupportResistanceResponse } from "../types/structure";

interface Props {
  sr: SupportResistanceResponse | null;
  loading?: boolean;
}

function StrengthBar({ value }: { value: number }) {
  return (
    <div style={{
      width: 36,
      height: 3,
      backgroundColor: "var(--border-subtle)",
      borderRadius: 1,
      overflow: "hidden",
    }}>
      <div style={{
        height: "100%",
        width: `${(value / 10) * 100}%`,
        backgroundColor: "var(--border-strong)",
        borderRadius: 1,
      }} />
    </div>
  );
}

export default function SupportResistancePanel({ sr, loading }: Props) {
  if (loading && !sr) {
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
        Computing support &amp; resistance zones…
      </div>
    );
  }

  if (!sr) return null;

  return (
    <div
      id="support-resistance-panel"
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
            S/R Zones
          </span>
          <span style={{ color: "var(--border-default)", fontSize: 10 }}>·</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--text-disabled)",
            textTransform: "uppercase",
          }}>
            Swing Clusters
          </span>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-disabled)",
        }}>
          {sr.total_swings_detected} pivots
        </span>
      </div>

      {/* Nearest Levels */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        padding: 10,
        backgroundColor: "var(--surface-inset)",
        border: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}>
            Nearest Support
          </span>
          {sr.nearest_support ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--positive)",
                fontVariantNumeric: "tabular-nums",
              }}>
                ₹{sr.nearest_support.price.toFixed(2)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
                -{sr.nearest_support.distance_pct}%
              </span>
            </div>
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-disabled)" }}>—</span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}>
            Nearest Resistance
          </span>
          {sr.nearest_resistance ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--negative)",
                fontVariantNumeric: "tabular-nums",
              }}>
                ₹{sr.nearest_resistance.price.toFixed(2)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
                +{sr.nearest_resistance.distance_pct}%
              </span>
            </div>
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-disabled)" }}>—</span>
          )}
        </div>
      </div>

      {/* Level Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Column headers */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 5,
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
            Level
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
              Touches
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)" }}>
              Strength
            </span>
          </div>
        </div>

        <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Resistance levels */}
          {sr.resistance_zones.slice(0, 3).map((z, idx) => (
            <div
              key={`res-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 8px",
                backgroundColor: "var(--surface-inset)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  fontWeight: 700,
                  padding: "1px 4px",
                  backgroundColor: "var(--negative-subtle)",
                  color: "var(--negative)",
                }}>
                  RES
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  ₹{z.price.toFixed(2)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
                  +{z.distance_pct}%
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                  {z.touches}x
                </span>
                <StrengthBar value={z.strength} />
              </div>
            </div>
          ))}

          {/* Support levels */}
          {sr.support_zones.slice(0, 3).map((z, idx) => (
            <div
              key={`sup-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 8px",
                backgroundColor: "var(--surface-inset)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  fontWeight: 700,
                  padding: "1px 4px",
                  backgroundColor: "var(--positive-subtle)",
                  color: "var(--positive)",
                }}>
                  SUP
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  ₹{z.price.toFixed(2)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
                  -{z.distance_pct}%
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                  {z.touches}x
                </span>
                <StrengthBar value={z.strength} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
