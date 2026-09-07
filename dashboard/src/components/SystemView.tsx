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
      num: "01", label: "Ingestion", status: "Active", statusColor: "#22C55E",
      title: "Market Providers",
      desc: "Provider abstraction (Yahoo Finance feed). Clean interface ready to attach NSE / BSE WebSocket feeds.",
      active: true,
    },
    {
      num: "02", label: "Processing", status: "Active", statusColor: "#22C55E",
      title: "Deterministic Engine",
      desc: "Candle anatomy, Varsity Marubozu classification, alert rules evaluator. Pure business logic ready for Kafka.",
      active: true,
    },
    {
      num: "03", label: "Persistence", status: "Active", statusColor: "#22C55E",
      title: "Relational / Tenant DB",
      desc: "SQLAlchemy ORM with strict user-scoping for Watchlists, Portfolios, Transactions, Alerts, and Journals.",
      active: true,
    },
    {
      num: "04", label: "Streaming", status: "Planned (v0.7)", statusColor: "#F59E0B",
      title: "Kafka Event Bus",
      desc: "Decouple ingestion events into partitioned Kafka topics for parallel multi-worker evaluation.",
      active: false,
    },
    {
      num: "05", label: "Computing", status: "Planned (v0.8)", statusColor: "#F59E0B",
      title: "Spark Streaming",
      desc: "Distributed stateful streaming across large universe of equities for real-time anomaly detection.",
      active: false,
    },
  ];

  return (
    <div
      id="system-module"
      className="flex-1 flex flex-col overflow-y-auto bg-[#000000] text-[#F8FAFC] p-6 gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1E2538]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#F8FAFC]">
            System Telemetry &amp; Architecture
          </span>
          <span className="text-[#334155]">·</span>
          <span className="text-xs text-[#64748B]">
            Xeroww Platform v0.6
          </span>
        </div>
        <button
          id="run-diagnostics-btn"
          onClick={runDiagnostics}
          disabled={loading}
          className="px-3.5 py-1.5 text-xs font-semibold bg-[#F59E0B] hover:bg-[#D97706] text-black disabled:opacity-50 transition-colors"
        >
          {loading ? "Probing…" : "Run Diagnostics"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-[#EF4444] border border-[#EF4444]/20 bg-[#EF4444]/10 p-3">
          {error}
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Health */}
        <div className="p-4 bg-[#0B0E14] border border-[#1E2538] flex flex-col gap-2">
          <div className="text-xs text-[#64748B]">Backend Health</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                health?.status === "healthy" ? "bg-[#22C55E]" : "bg-[#EF4444]"
              }`}
            />
            <span className="text-base font-bold text-[#F8FAFC]">
              {health?.status === "healthy" ? "Operational" : "Offline"}
            </span>
          </div>
          <div className="text-[11px] font-mono text-[#64748B]">Service: {health?.service ?? "xeroww-api"}</div>
        </div>

        {/* Latency */}
        <div className="p-4 bg-[#0B0E14] border border-[#1E2538] flex flex-col gap-2">
          <div className="text-xs text-[#64748B]">Probe Roundtrip</div>
          <div className="text-xl font-bold font-mono text-[#F59E0B] tabular-nums mt-0.5">
            {latency !== null ? `${latency} ms` : "—"}
          </div>
          <div className="text-[11px] font-mono text-[#64748B]">Last: {lastCheckTime || "—"}</div>
        </div>

        {/* Provider */}
        <div className="p-4 bg-[#0B0E14] border border-[#1E2538] flex flex-col gap-2">
          <div className="text-xs text-[#64748B]">Ingestion Feed</div>
          <div className="text-base font-bold text-[#F8FAFC] mt-0.5">
            {health?.data_provider ?? "Yahoo Finance Feed"}
          </div>
          <div className="text-[11px] text-[#64748B]">Near real-time (delayed)</div>
        </div>

        {/* Tenancy */}
        <div className="p-4 bg-[#0B0E14] border border-[#1E2538] flex flex-col gap-2">
          <div className="text-xs text-[#64748B]">Tenancy Context</div>
          <div className={`text-base font-bold mt-0.5 ${user ? "text-[#22C55E]" : "text-[#94A3B8]"}`}>
            {user ? "Authenticated" : "Anonymous"}
          </div>
          <div className="text-[11px] font-mono text-[#64748B]">
            {user ? `User #${user.id} [${user.role}]` : "No tenant session active"}
          </div>
        </div>
      </div>

      {/* Architecture Pipeline Map */}
      <div className="p-5 bg-[#0B0E14] border border-[#1E2538] flex flex-col gap-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#1E2538]">
          <span className="text-xs font-semibold text-[#F8FAFC]">
            Xeroww Distributed Pipeline Roadmap
          </span>
          <span className="text-[11px] text-[#64748B] font-mono">
            v0.6 Modular Monolith → v1.0 Distributed Cluster
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          {pipelineStages.map((stage) => (
            <div key={stage.num} className="p-3 bg-[#10141D] border border-[#1E2538] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-[#F59E0B]">
                  {stage.num} // {stage.label}
                </span>
                <span className="text-[10px] font-medium" style={{ color: stage.statusColor }}>
                  {stage.status}
                </span>
              </div>
              <div className="text-xs font-semibold text-[#F8FAFC]">
                {stage.title}
              </div>
              <p className="text-[11px] leading-relaxed text-[#94A3B8] m-0">
                {stage.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Security Spec */}
      <div className="p-5 bg-[#0B0E14] border border-[#1E2538] flex flex-col gap-3.5">
        <span className="text-xs font-semibold text-[#F8FAFC] pb-2.5 border-b border-[#1E2538] block">
          Security &amp; Multi-Tenancy Protocols
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              label: "Password Hashing",
              text: "BCrypt algorithm with auto-salted key derivation. Enforced 8+ chars, upper, lower, and digit policy.",
            },
            {
              label: "Authentication Tokens",
              text: "HS256 signed JSON Web Tokens. Dual-token model with short-lived access tokens and refresh rotation.",
            },
            {
              label: "Data Isolation",
              text: "Row-level user scoping on all domain entities. Verified by 100% passing tenant isolation automated test suite.",
            },
          ].map(({ label, text }) => (
            <div key={label}>
              <div className="text-xs font-semibold text-[#3B82F6] mb-1">
                {label}
              </div>
              <p className="text-xs leading-relaxed text-[#94A3B8] m-0">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
