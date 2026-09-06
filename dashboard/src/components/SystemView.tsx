// src/components/SystemView.tsx
// Institutional system telemetry, health diagnostics, and architecture pipeline monitoring.
// Pitch-black terminal aesthetics.

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

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <div
      id="system-module"
      className="flex-1 flex flex-col overflow-y-auto bg-[#000] text-[#e0e0e0] p-6 gap-6"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-3">
          <span className="text-[#00E5FF] text-[13px] font-bold tracking-[0.2em]">
            SYSTEM_TELEMETRY &amp; ARCHITECTURE
          </span>
          <span className="text-[#333] text-[12px]">|</span>
          <span className="text-[#666] text-[11px] tracking-widest">
            XEROWW PLATFORM V0.6
          </span>
        </div>

        <button
          id="run-diagnostics-btn"
          onClick={runDiagnostics}
          disabled={loading}
          className="px-3 py-1 bg-[#0A0A0A] hover:bg-[#151515] border border-[#222] hover:border-[#00E5FF] text-[#00E5FF] text-[10px] tracking-widest uppercase transition-colors"
        >
          {loading ? "PROBING..." : "RUN DIAGNOSTICS"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-[#FF0000]/10 border border-[#FF0000]/30 text-[#FF4D4D] text-[11px]">
          {error}
        </div>
      )}

      {/* Grid: 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Health */}
        <div className="p-4 bg-[#050505] border border-[#1A1A1A] flex flex-col gap-2">
          <div className="text-[10px] text-[#555] tracking-widest uppercase">BACKEND HEALTH</div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                health?.status === "healthy" ? "bg-[#22c55e] animate-pulse" : "bg-[#ff4d4d]"
              }`}
            />
            <span className="text-[14px] font-bold text-[#FFF] tracking-wider uppercase">
              {health?.status ?? "OFFLINE"}
            </span>
          </div>
          <div className="text-[10px] text-[#444] mt-1">Service: {health?.service ?? "xeroww-api"}</div>
        </div>

        {/* Card 2: Latency */}
        <div className="p-4 bg-[#050505] border border-[#1A1A1A] flex flex-col gap-2">
          <div className="text-[10px] text-[#555] tracking-widest uppercase">PROBE ROUNDTRIP</div>
          <div className="text-[18px] font-bold text-[#00E5FF] tracking-wider">
            {latency !== null ? `${latency} ms` : "---"}
          </div>
          <div className="text-[10px] text-[#444]">Last checked: {lastCheckTime || "---"}</div>
        </div>

        {/* Card 3: Provider */}
        <div className="p-4 bg-[#050505] border border-[#1A1A1A] flex flex-col gap-2">
          <div className="text-[10px] text-[#555] tracking-widest uppercase">INGESTION FEED</div>
          <div className="text-[14px] font-bold text-[#DDD] tracking-wider uppercase">
            {health?.data_provider ?? "YAHOO FINANCE"}
          </div>
          <div className="text-[10px] text-[#444]">Near real-time (delayed)</div>
        </div>

        {/* Card 4: Tenant Isolation */}
        <div className="p-4 bg-[#050505] border border-[#1A1A1A] flex flex-col gap-2">
          <div className="text-[10px] text-[#555] tracking-widest uppercase">TENANCY CONTEXT</div>
          <div className="text-[14px] font-bold text-[#22c55e] tracking-wider uppercase">
            {user ? "AUTHENTICATED" : "ANONYMOUS"}
          </div>
          <div className="text-[10px] text-[#444]">
            {user ? `UID #${user.id} [${user.role}]` : "No tenant session"}
          </div>
        </div>
      </div>

      {/* Architecture Pipeline Map */}
      <div className="p-5 bg-[#050505] border border-[#1A1A1A] flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#151515] pb-2">
          <span className="text-[11px] font-bold text-[#FFF] tracking-[0.15em] uppercase">
            XEROWW DISTRIBUTED PIPELINE ROADMAP
          </span>
          <span className="text-[9px] text-[#555] tracking-widest">
            V0.6 MODULAR MONOLITH → V1.0 DISTRIBUTED CLUSTER
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px]">
          {/* Stage 1 */}
          <div className="p-3 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#00E5FF] font-bold text-[10px]">01 // INGESTION</span>
              <span className="text-[9px] text-[#22c55e]">ACTIVE</span>
            </div>
            <div className="text-[#FFF] font-semibold">Market Providers</div>
            <p className="text-[10px] text-[#555] leading-relaxed">
              Provider abstraction (Yahoo Finance feed). Clean interface ready to attach NSE / BSE WebSocket feeds.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-3 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#00E5FF] font-bold text-[10px]">02 // PROCESSING</span>
              <span className="text-[9px] text-[#22c55e]">ACTIVE</span>
            </div>
            <div className="text-[#FFF] font-semibold">Deterministic Engine</div>
            <p className="text-[10px] text-[#555] leading-relaxed">
              Candle anatomy, Varsity Marubozu classification, alert rules evaluator. Pure business logic ready for Kafka.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-3 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#00E5FF] font-bold text-[10px]">03 // PERSISTENCE</span>
              <span className="text-[9px] text-[#22c55e]">ACTIVE</span>
            </div>
            <div className="text-[#FFF] font-semibold">Relational / Tenant DB</div>
            <p className="text-[10px] text-[#555] leading-relaxed">
              SQLAlchemy ORM with strict user-scoping for Watchlists, Portfolios, Transactions, Alerts, and Journals.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-3 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#888] font-bold text-[10px]">04 // STREAMING</span>
              <span className="text-[9px] text-[#eab308]">PLANNED (V0.7)</span>
            </div>
            <div className="text-[#FFF] font-semibold">Kafka Event Bus</div>
            <p className="text-[10px] text-[#555] leading-relaxed">
              Decouple ingestion events into partitioned Kafka topics for parallel multi-worker evaluation.
            </p>
          </div>

          {/* Stage 5 */}
          <div className="p-3 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#888] font-bold text-[10px]">05 // COMPUTING</span>
              <span className="text-[9px] text-[#eab308]">PLANNED (V0.8)</span>
            </div>
            <div className="text-[#FFF] font-semibold">Spark Streaming</div>
            <p className="text-[10px] text-[#555] leading-relaxed">
              Distributed stateful streaming across large universe of equities for real-time anomaly detection.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Cryptography Spec */}
      <div className="p-5 bg-[#050505] border border-[#1A1A1A] flex flex-col gap-3">
        <span className="text-[11px] font-bold text-[#FFF] tracking-[0.15em] uppercase border-b border-[#151515] pb-2">
          SECURITY &amp; MULTI-TENANCY PROTOCOLS
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px]">
          <div>
            <div className="text-[#00E5FF] text-[10px] font-bold mb-1">PASSWORD HASHING</div>
            <p className="text-[#777] text-[10px] leading-relaxed">
              BCrypt algorithm with auto-salted key derivation. Enforced 8+ chars, upper, lower, and digit policy.
            </p>
          </div>
          <div>
            <div className="text-[#00E5FF] text-[10px] font-bold mb-1">AUTHENTICATION TOKENS</div>
            <p className="text-[#777] text-[10px] leading-relaxed">
              HS256 signed JSON Web Tokens. Dual-token model with short-lived access tokens and refresh rotation.
            </p>
          </div>
          <div>
            <div className="text-[#00E5FF] text-[10px] font-bold mb-1">DATA ISOLATION</div>
            <p className="text-[#777] text-[10px] leading-relaxed">
              Row-level user scoping on all domain entities. Verified by 100% passing tenant isolation automated test suite.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
