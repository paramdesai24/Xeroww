// src/components/PatternCard.tsx
// Candlestick Pattern Analysis — graphite-and-paper design system.

import { ShieldCheck, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Layers } from "lucide-react";
import type { PatternData } from "../types/market";

interface PatternCardProps {
  pattern: PatternData | null;
}

export default function PatternCard({ pattern }: PatternCardProps) {
  if (!pattern) {
    return (
      <div style={{
        padding: 12,
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: 8,
        }}>
          <h3 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            margin: 0,
          }}>
            Pattern Analysis
          </h3>
        </div>
        <div style={{
          padding: "20px 0",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.08em",
          color: "var(--text-disabled)",
          textTransform: "uppercase",
        }}>
          Scanning historical sessions…
        </div>
      </div>
    );
  }

  const detectedList = pattern.detected_patterns ?? [];
  const ctx = pattern.contextual_pattern;
  const isMarubozu = pattern.pattern !== "none";
  const hasPatterns = isMarubozu || detectedList.length > 0;
  const stopLoss = typeof pattern.stop_loss === "number"
    ? pattern.stop_loss
    : typeof detectedList[detectedList.length - 1]?.context?.stop_loss === "number"
    ? (detectedList[detectedList.length - 1].context.stop_loss as number)
    : null;

  const primaryName = isMarubozu
    ? pattern.pattern === "bullish_marubozu"
      ? "BULLISH MARUBOZU"
      : "BEARISH MARUBOZU"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].pattern.toUpperCase()
    : "NO CANDLE PATTERN";

  const isBullish = isMarubozu
    ? pattern.pattern === "bullish_marubozu"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].direction === "bullish"
    : false;

  const isBearish = isMarubozu
    ? pattern.pattern === "bearish_marubozu"
    : detectedList.length > 0
    ? detectedList[detectedList.length - 1].direction === "bearish"
    : false;

  const directionStyle = isBullish
    ? { color: "var(--positive)", bg: "var(--positive-subtle)", border: "var(--positive-border)" }
    : isBearish
    ? { color: "var(--negative)", bg: "var(--negative-subtle)", border: "var(--negative-border)" }
    : { color: "var(--text-secondary)", bg: "var(--neutral-subtle)", border: "var(--border-default)" };

  return (
    <div style={{
      padding: 12,
      backgroundColor: "var(--surface-raised)",
      border: "1px solid var(--border-subtle)",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 8,
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            margin: 0,
          }}>
            Pattern Analysis
          </h3>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            padding: "1px 4px",
            backgroundColor: "var(--surface-inset)",
            color: "var(--accent)",
            border: "1px solid var(--border-subtle)",
          }}>
            V2
          </span>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-tertiary)",
        }}>
          {pattern.signal_day ?? pattern.latest_candle?.date ?? "Latest Session"}
        </span>
      </div>

      {hasPatterns ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Primary Pattern Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 10px",
            border: `1px solid ${directionStyle.border}`,
            backgroundColor: directionStyle.bg,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: directionStyle.color,
            }}>
              {isBullish ? <TrendingUp size={12} /> : isBearish ? <TrendingDown size={12} /> : <Layers size={12} />}
              <span>{primaryName}</span>
            </div>
            <CheckCircle2 size={12} style={{ color: directionStyle.color }} />
          </div>

          {/* Interpretation */}
          <div style={{
            padding: "8px 10px",
            backgroundColor: "var(--surface-inset)",
            border: "1px solid var(--border-subtle)",
          }}>
            <span style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
              marginBottom: 5,
            }}>
              Deterministic Interpretation
            </span>
            <p style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              margin: 0,
            }}>
              {detectedList.length > 0
                ? detectedList[detectedList.length - 1].explanation
                : pattern.rationale}
            </p>
          </div>

          {/* Contextual Market Structure */}
          {ctx && (
            <div style={{
              padding: "8px 10px",
              backgroundColor: "var(--surface-inset)",
              border: "1px solid var(--border-subtle)",
            }}>
              <span style={{
                display: "block",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent)",
                marginBottom: 6,
              }}>
                Structural Context
              </span>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 6,
              }}>
                <div>
                  <span style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-disabled)",
                    marginBottom: 2,
                  }}>
                    Nearest Support
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {ctx.nearest_support_price
                      ? `₹${ctx.nearest_support_price.toFixed(2)} (-${ctx.support_distance_pct}%)`
                      : "None nearby"}
                  </span>
                </div>
                <div>
                  <span style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-disabled)",
                    marginBottom: 2,
                  }}>
                    Volume Profile
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {ctx.rvol}x RVOL ({ctx.volume_state})
                  </span>
                </div>
              </div>
              <p style={{
                fontFamily: "var(--font-sans)",
                fontSize: 9,
                lineHeight: 1.6,
                color: "var(--text-tertiary)",
                margin: 0,
                paddingTop: 6,
                borderTop: "1px solid var(--border-subtle)",
              }}>
                {ctx.context_summary}
              </p>
            </div>
          )}

          {/* Stop Loss */}
          {typeof stopLoss === "number" && !isNaN(stopLoss) && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              backgroundColor: "var(--surface-inset)",
              border: "1px solid var(--border-subtle)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "var(--negative)",
              }}>
                <ShieldAlert size={11} />
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  Protective Stop Reference
                </span>
              </div>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}>
                ₹{stopLoss.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-primary)",
          }}>
            No Recognized Pattern
          </span>
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            margin: 0,
          }}>
            No single or multi-candle pattern detected on the latest trading sessions.
          </p>
          <div style={{
            paddingTop: 8,
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}>
            <ShieldCheck size={11} style={{ color: "var(--text-tertiary)", flexShrink: 0, marginTop: 1 }} />
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: 9,
              lineHeight: 1.6,
              color: "var(--text-tertiary)",
            }}>
              Pattern Engine scans for Marubozu, Doji, Spinning Top, Hammer, Hanging Man, Engulfing, Harami, and Stars.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
