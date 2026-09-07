// src/components/SignalAlignmentCard.tsx
// Deterministic signal confluence card — graphite-and-paper design system.

import { useState } from "react";
import type { SignalAlignmentResponse } from "../types/structure";

interface Props {
  alignment: SignalAlignmentResponse | null;
  loading?: boolean;
}

export default function SignalAlignmentCard({ alignment, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !alignment) {
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
        Evaluating signal alignment…
      </div>
    );
  }

  if (!alignment) return null;

  const isBullish = alignment.dominant_bias === "BULLISH_CONFLUENCE";
  const isBearish = alignment.dominant_bias === "BEARISH_CONFLUENCE";

  const biasBadge = isBullish
    ? { color: "var(--positive)", bg: "var(--positive-subtle)", border: "var(--positive-border)" }
    : isBearish
    ? { color: "var(--negative)", bg: "var(--negative-subtle)", border: "var(--negative-border)" }
    : { color: "var(--text-tertiary)", bg: "var(--neutral-subtle)", border: "var(--border-default)" };

  return (
    <div
      id="signal-alignment-card"
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
            Signal Confluence
          </span>
          <span style={{ color: "var(--border-default)", fontSize: 10 }}>·</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--text-disabled)",
            textTransform: "uppercase",
          }}>
            Rule Tally
          </span>
        </div>
        <span
          id="signal-bias-badge"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "2px 7px",
            border: `1px solid ${biasBadge.border}`,
            backgroundColor: biasBadge.bg,
            color: biasBadge.color,
          }}
        >
          {alignment.dominant_bias.replace(/_/g, " ")}
        </span>
      </div>

      {/* Tally */}
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
            Bullish
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--positive)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {alignment.bullish_alignment_count}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-disabled)",
            }}>
              / {alignment.alignment_total}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}>
            Bearish
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--negative)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {alignment.bearish_alignment_count}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-disabled)",
            }}>
              / {alignment.alignment_total}
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <p style={{
        fontFamily: "var(--font-sans)",
        fontSize: 10,
        lineHeight: 1.6,
        color: "var(--text-secondary)",
        margin: 0,
      }}>
        {alignment.factual_summary}
      </p>

      {/* Expand conditions */}
      <div style={{ paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
        <button
          id="toggle-conditions-btn"
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: 0,
            transition: "color 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <span>{expanded ? "▲ Hide conditions" : "▼ Inspect 12 conditions"}</span>
          <span style={{ color: "var(--text-disabled)", fontSize: 8, letterSpacing: "0.06em" }}>
            DETERMINISTIC RULES
          </span>
        </button>

        {expanded && (
          <div style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: 200,
            overflowY: "auto",
          }}>
            {alignment.conditions.map((c) => (
              <div
                key={c.condition_id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "6px 8px",
                  backgroundColor: "var(--surface-inset)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  fontWeight: 700,
                  flexShrink: 0,
                  padding: "1px 4px",
                  backgroundColor: c.satisfied
                    ? c.bias === "bullish"
                      ? "var(--positive-subtle)"
                      : "var(--negative-subtle)"
                    : "var(--neutral-subtle)",
                  color: c.satisfied
                    ? c.bias === "bullish"
                      ? "var(--positive)"
                      : "var(--negative)"
                    : "var(--text-disabled)",
                }}>
                  {c.satisfied ? "YES" : "NO"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 600,
                    color: c.satisfied ? "var(--text-primary)" : "var(--text-disabled)",
                  }}>
                    {c.label} <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>({c.bias})</span>
                  </span>
                  <span style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 9,
                    lineHeight: 1.5,
                    color: "var(--text-tertiary)",
                  }}>
                    {c.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
