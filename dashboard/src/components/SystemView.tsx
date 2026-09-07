// src/components/SystemView.tsx
// System telemetry, health diagnostics, and architecture pipeline monitoring.
// Graphite-and-paper design system.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { HealthStatus } from "../types/market";
import type { UserProfile } from "../types/auth";

interface Props {
  user: UserProfile | null;
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  backgroundColor: "var(--surface-raised)",
  border: "1px solid var(--border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const cardLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--text-disabled)",
};

const pipelineCardStyle: React.CSSProperties = {
  padding: 12,
  backgroundColor: "var(--surface-inset)",
  border: "1px solid var(--border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export default function SystemView({ user }: Props) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>("");

  const runDiagnostics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const start = performance.now();
      const h = await api.health();
      const end = performance.now();
      setLatency(Math.round(end - start));
      setHealth(h);
      setLastCheckTime(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Diagnostics probe failed");
      setLatency(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runDiagnostics(); }, [runDiagnostics]);

  const pipelineStages = [
    {
      num: "01", label: "INGESTION", status: "ACTIVE", statusColor: "var(--positive)",
      title: "Market Providers",
      desc: "Provider abstraction (Yahoo Finance feed). Clean interface ready to attach NSE / BSE WebSocket feeds.",
      active: true,
    },
    {
      num: "02", label: "PROCESSING", status: "ACTIVE", statusColor: "var(--positive)",
      title: "Deterministic Engine",
      desc: "Candle anatomy, Varsity Marubozu classification, alert rules evaluator. Pure business logic ready for Kafka.",
      active: true,
    },
    {
      num: "03", label: "PERSISTENCE", status: "ACTIVE", statusColor: "var(--positive)",
      title: "Relational / Tenant DB",
      desc: "SQLAlchemy ORM with strict user-scoping for Watchlists, Portfolios, Transactions, Alerts, and Journals.",
      active: true,
    },
    {
      num: "04", label: "STREAMING", status: "PLANNED (V0.7)", statusColor: "var(--warning)",
      title: "Kafka Event Bus",
      desc: "Decouple ingestion events into partitioned Kafka topics for parallel multi-worker evaluation.",
      active: false,
    },
    {
      num: "05", label: "COMPUTING", status: "PLANNED (V0.8)", statusColor: "var(--warning)",
      title: "Spark Streaming",
      desc: "Distributed stateful streaming across large universe of equities for real-time anomaly detection.",
      active: false,
    },
  ];

  return (
    <div
      id="system-module"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        backgroundColor: "var(--surface-base)",
        color: "var(--text-primary)",
        padding: 24,
        gap: 20,
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 12,
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-primary)" }}>
            SYSTEM TELEMETRY
          </span>
          <span style={{ color: "var(--border-strong)", fontSize: 12 }}>·</span>
          <span style={{ fontSize: 10, letterSpacing: "0.10em", color: "var(--text-tertiary)" }}>
            XEROWW PLATFORM V0.6
          </span>
        </div>
        <button
          id="run-diagnostics-btn"
          onClick={runDiagnostics}
          disabled={loading}
          style={{
            padding: "5px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            cursor: loading ? "not-allowed" : "pointer",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--surface-raised)",
            color: loading ? "var(--text-disabled)" : "var(--text-secondary)",
            opacity: loading ? 0.6 : 1,
            transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1), color 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
          onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          {loading ? "Probing…" : "Run Diagnostics"}
        </button>
      </div>

      {error && (
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          color: "var(--negative)",
          border: "1px solid var(--negative-border)",
          backgroundColor: "var(--negative-subtle)",
          padding: "8px 12px",
        }}>
          {error}
        </div>
      )}

      {/* 4 Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {/* Health */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Backend Health</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              backgroundColor: health?.status === "healthy" ? "var(--positive)" : "var(--negative)",
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>
              {health?.status ?? "OFFLINE"}
            </span>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-disabled)" }}>Service: {health?.service ?? "xeroww-api"}</div>
        </div>

        {/* Latency */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Probe Roundtrip</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            {latency !== null ? `${latency} ms` : "—"}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-disabled)" }}>Last: {lastCheckTime || "—"}</div>
        </div>

        {/* Provider */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Ingestion Feed</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>
            {health?.data_provider ?? "YAHOO FINANCE"}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-disabled)" }}>Near real-time (delayed)</div>
        </div>

        {/* Tenancy */}
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Tenancy Context</div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: user ? "var(--positive)" : "var(--text-tertiary)",
            textTransform: "uppercase",
          }}>
            {user ? "AUTHENTICATED" : "ANONYMOUS"}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-disabled)" }}>
            {user ? `UID #${user.id} [${user.role}]` : "No tenant session"}
          </div>
        </div>
      </div>

      {/* Architecture Pipeline Map */}
      <div style={{
        padding: 20,
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-primary)" }}>
            Xeroww Distributed Pipeline Roadmap
          </span>
          <span style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.08em" }}>
            V0.6 MODULAR MONOLITH → V1.0 DISTRIBUTED CLUSTER
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {pipelineStages.map((stage) => (
            <div key={stage.num} style={pipelineCardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: stage.active ? "var(--accent)" : "var(--text-disabled)",
                  letterSpacing: "0.06em",
                }}>
                  {stage.num} // {stage.label}
                </span>
                <span style={{ fontSize: 8, color: stage.statusColor, letterSpacing: "0.06em" }}>
                  {stage.status}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                {stage.title}
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 9, lineHeight: 1.6, color: "var(--text-tertiary)", margin: 0 }}>
                {stage.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Security Spec */}
      <div style={{
        padding: 20,
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
          display: "block",
        }}>
          Security &amp; Multi-Tenancy Protocols
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            {
              label: "PASSWORD HASHING",
              text: "BCrypt algorithm with auto-salted key derivation. Enforced 8+ chars, upper, lower, and digit policy.",
            },
            {
              label: "AUTHENTICATION TOKENS",
              text: "HS256 signed JSON Web Tokens. Dual-token model with short-lived access tokens and refresh rotation.",
            },
            {
              label: "DATA ISOLATION",
              text: "Row-level user scoping on all domain entities. Verified by 100% passing tenant isolation automated test suite.",
            },
          ].map(({ label, text }) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", color: "var(--accent)", marginBottom: 5 }}>
                {label}
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
