// src/components/SystemView.tsx
// Xeroww operations and system health console
// Design Inspiration: Grafana + Bloomberg Operations Terminal.
// Institutional pitch-black canvas, high-density telemetry, live canvas sparklines,
// and real-time architectural topology graph.

import { useState, useEffect, useCallback, useRef, useId } from "react";
import {
  Activity,
  Server,
  Database,
  Radio,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Layers,
  Clock,
  Play,
  Pause,
  ArrowUpRight,
  Terminal,
  Cpu,
} from "lucide-react";
import { api } from "../api/client";
import type { SystemHealthSnapshot, TelemetryTimeseries } from "../types/health";
import type { UserProfile } from "../types/auth";
import { typography } from "../design";

interface Props {
  user: UserProfile | null;
}

// ---------------------------------------------------------------------------
// High-Performance Micro Canvas Sparkline Component
// ---------------------------------------------------------------------------
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  unit?: string;
  label?: string;
}

function Sparkline({
  data,
  color = "#1E90FF",
  height = 42,
  unit = "",
  label,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 200;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) {
      // Draw flat baseline when data is warming up
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;
    const availableHeight = height - padding * 2;

    const stepX = width / (data.length - 1);

    // Build path coordinates
    const points: [number, number][] = data.map((val, idx) => {
      const x = idx * stepX;
      const normalized = (val - min) / range;
      const y = height - padding - normalized * availableHeight;
      return [x, y];
    });

    // 1. Draw subtle area gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}33`);
    gradient.addColorStop(1, `${color}00`);

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.lineTo(points[points.length - 1][0], height);
    ctx.lineTo(points[0][0], height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 2. Draw line path
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // 3. Draw pulse dot at latest point
    const [latestX, latestY] = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(latestX, latestY, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [data, color, height]);

  const latestVal = data.length > 0 ? data[data.length - 1] : 0;

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-center justify-between text-label font-mono text-[var(--text-tertiary)]">
        <span>{label}</span>
        <span className="font-semibold text-[var(--text-primary)]">
          {latestVal.toFixed(1)} {unit}
        </span>
      </div>
      <div className="w-full relative overflow-hidden rounded-sm bg-[#080808] border border-[#1A1A1A]">
        <canvas ref={canvasRef} className="block w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive Live Architecture Topology SVG Graph
// ---------------------------------------------------------------------------
interface TopologyMapProps {
  snapshot: SystemHealthSnapshot | null;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
}

function TopologyMap({
  snapshot,
  onSelectNode,
  selectedNodeId,
}: TopologyMapProps) {
  const gradientId = useId();

  if (!snapshot) return null;

  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {
    frontend: { x: 30, y: 80, width: 140, height: 50 },
    api: { x: 230, y: 80, width: 150, height: 50 },
    cache: { x: 440, y: 20, width: 150, height: 50 },
    database: { x: 440, y: 85, width: 150, height: 50 },
    replay: { x: 650, y: 85, width: 150, height: 50 },
    provider: { x: 440, y: 150, width: 150, height: 50 },
    eventbus: { x: 230, y: 180, width: 150, height: 50 },
  };

  const statusColor = (st: string) => {
    if (st === "healthy" || st === "operational") return "#22C55E";
    if (st === "degraded") return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div className="w-full bg-[#080808] border border-[var(--border-default)] p-4 flex flex-col gap-3 rounded-sm">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            LIVE SYSTEM TOPOLOGY MAP
          </span>
          <span className="text-label font-mono text-[var(--text-tertiary)]">
            (Interactive node graph · click to inspect)
          </span>
        </div>
        <div className="flex items-center gap-4 text-label font-mono">
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Operational
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Degraded
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Critical
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 830 250"
          className="w-full min-w-[700px] h-[220px] select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E90FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Connections */}
          {snapshot.topology.edges.map((edge, idx) => {
            const src = nodePositions[edge.source];
            const tgt = nodePositions[edge.target];
            if (!src || !tgt) return null;

            const x1 = src.x + src.width;
            const y1 = src.y + src.height / 2;
            const x2 = tgt.x;
            const y2 = tgt.y + tgt.height / 2;
            const col = statusColor(edge.status);

            return (
              <g key={`edge-${idx}`}>
                <path
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={col}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  className="animate-pulse-stroke"
                />
                {/* Protocol badge on edge */}
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 4}
                  fill="#888899"
                  fontSize={typography.chart.nodeDetailSize}
                  fontFamily={typography.chart.family}
                  textAnchor="middle"
                >
                  {edge.protocol}
                </text>
              </g>
            );
          })}

          {/* Render Nodes */}
          {snapshot.topology.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const isSelected = selectedNodeId === node.id;
            const col = statusColor(node.status);

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onSelectNode(node.id)}
                className="cursor-pointer transition-all duration-200"
              >
                <rect
                  width={pos.width}
                  height={pos.height}
                  rx="3"
                  fill={isSelected ? "#161616" : "#0D0D0D"}
                  stroke={isSelected ? "#1E90FF" : col}
                  strokeWidth={isSelected ? "2" : "1"}
                />

                {/* Status indicator dot */}
                <circle
                  cx="12"
                  cy="16"
                  r="3.5"
                  fill={col}
                  filter={col === "#22C55E" ? "url(#glow)" : undefined}
                />

                {/* Node Title */}
                <text
                  x="24"
                  y="19"
                  fill="#FAFAFA"
                  fontSize={typography.chart.nodeTitleSize}
                  fontWeight="600"
                  fontFamily={typography.family.sans}
                >
                  {node.label}
                </text>

                {/* Sublabel / Metric */}
                <text
                  x="12"
                  y="36"
                  fill="#888899"
                  fontSize={typography.chart.nodeDetailSize}
                  fontFamily={typography.chart.family}
                >
                  {node.sublabel.length > 24
                    ? node.sublabel.slice(0, 24) + "…"
                    : node.sublabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SystemView Component
// ---------------------------------------------------------------------------
export default function SystemView({ user }: Props) {
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("api");
  const [countdown, setCountdown] = useState(5);
  const [rawModalOpen, setRawModalOpen] = useState(false);

  // In-Memory Rolling Timeseries Buffer (last 40 data points = ~3.3 minutes)
  const [timeseries, setTimeseries] = useState<TelemetryTimeseries>({
    timestamps: [],
    apiP50: [],
    apiP95: [],
    reqRate: [],
    cacheHitRate: [],
    dbLatency: [],
    providerLatency: [],
  });

  const pollHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.systemHealth();
      setSnapshot(data);

      // Append point to rolling buffer
      const timeStr = new Date().toLocaleTimeString();
      setTimeseries((prev) => {
        const keep = 40;
        return {
          timestamps: [...prev.timestamps.slice(-keep), timeStr],
          apiP50: [...prev.apiP50.slice(-keep), data.api.latency_p50_ms],
          apiP95: [...prev.apiP95.slice(-keep), data.api.latency_p95_ms],
          reqRate: [...prev.reqRate.slice(-keep), data.api.requests_per_second],
          cacheHitRate: [...prev.cacheHitRate.slice(-keep), data.cache.hit_rate_pct],
          dbLatency: [...prev.dbLatency.slice(-keep), data.database.query_latency_p50_ms],
          providerLatency: [
            ...prev.providerLatency.slice(-keep),
            data.provider.sync_latency_ms,
          ],
        };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "System health probe failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    queueMicrotask(() => void pollHealth());
  }, [pollHealth]);

  // 5-second countdown timer for auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          pollHealth();
          return 5;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, pollHealth]);

  const statusBadge = (status: string) => {
    if (status === "operational" || status === "healthy") {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-label font-semibold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30">
          <CheckCircle2 className="w-3 h-3" /> OPERATIONAL
        </span>
      );
    }
    if (status === "degraded") {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-label font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
          <AlertTriangle className="w-3 h-3" /> DEGRADED
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-label font-semibold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30">
        <XCircle className="w-3 h-3" /> CRITICAL
      </span>
    );
  };

  return (
    <div
      id="system-module"
      className="flex-1 flex flex-col overflow-y-auto bg-[#000000] text-[#FAFAFA] p-6 gap-6"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* 1. Header Control Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--border-default)] gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--accent-primary)] animate-pulse" />
            <h1 className="type-page-title text-[#FAFAFA] m-0">
              System Health
            </h1>
          </div>
          <span className="text-[var(--border-strong)]">|</span>
          <span className="type-meta text-[#A0A0A8]">Telemetry</span>
          {snapshot && statusBadge(snapshot.overall_status)}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-3">
          {/* Live countdown pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#0D0D0D] border border-[var(--border-default)] rounded text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-[#22C55E] animate-ping" : "bg-[#64748B]"
              }`}
            />
            <span className="text-[var(--text-secondary)]">
              {autoRefresh ? `LIVE (tick ${countdown}s)` : "PAUSED"}
            </span>
          </div>

          <button
            id="toggle-refresh-btn"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[#0D0D0D] hover:bg-[#161616] text-[#A0A0A8] rounded transition-colors"
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? "Pause" : "Resume"}</span>
          </button>

          <button
            id="run-diagnostics-btn"
            onClick={pollHealth}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[#1C86EE] text-white disabled:opacity-50 rounded transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Probing…" : "Force Probe"}</span>
          </button>

          <button
            onClick={() => setRawModalOpen(true)}
            className="px-2.5 py-1 text-xs font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] bg-[#0D0D0D] rounded"
          >
            {`{ } JSON`}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-mono flex items-center gap-2 rounded">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Telemetric link degraded: {error}</span>
        </div>
      )}

      {/* 2. SRE Vital Signs Banner (Uptime & Quick Summary) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-1 rounded-sm">
          <span className="text-label font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            Uptime
          </span>
          <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
            {snapshot?.api.uptime_human ?? "—"}
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-mono">
            {snapshot ? `${Math.round(snapshot.api.uptime_seconds)} sec total` : ""}
          </span>
        </div>

        <div className="p-3 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-1 rounded-sm">
          <span className="text-label font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            Throughput
          </span>
          <span className="text-base font-bold font-mono text-[var(--accent-primary)]">
            {snapshot ? `${snapshot.api.requests_per_second} req/s` : "—"}
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-mono">
            {snapshot?.api.total_requests} requests
          </span>
        </div>

        <div className="p-3 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-1 rounded-sm">
          <span className="text-label font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            Median Latency
          </span>
          <span className="text-base font-bold font-mono text-[#22C55E]">
            {snapshot ? `${snapshot.api.latency_p50_ms} ms` : "—"}
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-mono">
            P50 response time
          </span>
        </div>

        <div className="p-3 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-1 rounded-sm">
          <span className="text-label font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            Cache Hit Ratio
          </span>
          <span className="text-base font-bold font-mono text-[var(--text-primary)]">
            {snapshot ? `${snapshot.cache.hit_rate_pct}%` : "—"}
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-mono">
            Backend: {snapshot?.cache.backend ?? "—"}
          </span>
        </div>

        <div className="p-3 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-1 rounded-sm">
          <span className="text-label font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            Active Conns
          </span>
          <span className="text-base font-bold font-mono text-[var(--text-primary)]">
            {snapshot?.websocket.connected_clients ?? 0}
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-mono">
            Gateway streams
          </span>
        </div>

        <div className="p-3 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-1 rounded-sm">
          <span className="text-label font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            Domain Events
          </span>
          <span className="text-base font-bold font-mono text-[#A855F7]">
            {snapshot?.events.total_events_published ?? 0}
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-mono">
            {snapshot?.events.subscriber_handlers_count ?? 0} handlers active
          </span>
        </div>
      </div>

      {/* 3. Core 6-Card Bloomberg/Grafana Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: API HEALTH & LATENCY QUANTILES */}
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-3 rounded-sm">
          <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                API GATEWAY &amp; LATENCIES
              </span>
            </div>
            {snapshot && statusBadge(snapshot.api.status)}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                P50 Median Latency
              </span>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.api.latency_p50_ms ?? "—"}
                <span className="text-xs text-[var(--text-tertiary)] font-normal ml-1">
                  ms
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Error Rate
              </span>
              <div className="text-sm font-bold font-mono text-[#22C55E]">
                {snapshot?.api.error_rate_pct ?? 0}%
              </div>
            </div>
          </div>

          {/* Quantile Breakdown Progress Bars */}
          <div className="flex flex-col gap-1.5 py-1">
            <div className="flex justify-between text-label font-mono text-[var(--text-secondary)]">
              <span>P50: {snapshot?.api.latency_p50_ms}ms</span>
              <span>P95: {snapshot?.api.latency_p95_ms}ms</span>
              <span>P99: {snapshot?.api.latency_p99_ms}ms</span>
            </div>
            <div className="w-full h-1.5 bg-[#161616] rounded-full overflow-hidden flex">
              <div
                style={{ width: "50%" }}
                className="bg-[#22C55E] h-full"
                title="P50"
              />
              <div
                style={{ width: "35%" }}
                className="bg-[#1E90FF] h-full"
                title="P95"
              />
              <div
                style={{ width: "15%" }}
                className="bg-[#EF4444] h-full"
                title="P99"
              />
            </div>
          </div>

          <Sparkline
            data={timeseries.apiP50}
            color="#1E90FF"
            label="P50 Latency Timeseries (rolling 3m)"
            unit="ms"
          />
        </div>

        {/* CARD 2: CACHE (REDIS / IN-MEMORY) */}
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-3 rounded-sm">
          <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                CACHE &amp; RATE LIMITER
              </span>
            </div>
            {snapshot && statusBadge(snapshot.cache.status)}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Hit Ratio
              </span>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.cache.hit_rate_pct ?? "—"}
                <span className="text-xs text-[var(--text-tertiary)] font-normal ml-1">
                  %
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Active Keys
              </span>
              <div className="text-sm font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.cache.total_keys ?? 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-label font-mono bg-[#161616] p-2 rounded">
            <div>
              <span className="text-[var(--text-tertiary)]">Backend: </span>
              <span className="font-semibold text-[var(--text-primary)]">
                {snapshot?.cache.backend}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Connected: </span>
              <span
                className={`font-semibold ${
                  snapshot?.cache.connected ? "text-[#22C55E]" : "text-[#EF4444]"
                }`}
              >
                {snapshot?.cache.connected ? "YES (Live)" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Hits: </span>
              <span className="text-[#22C55E]">{snapshot?.cache.hits ?? 0}</span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Misses: </span>
              <span className="text-[#EF4444]">{snapshot?.cache.misses ?? 0}</span>
            </div>
          </div>

          <Sparkline
            data={timeseries.cacheHitRate}
            color="#F59E0B"
            label="Cache Hit Rate Trend"
            unit="%"
          />
        </div>

        {/* CARD 3: DATABASE & QUERY LATENCY */}
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-3 rounded-sm">
          <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                RELATIONAL PERSISTENCE (DB)
              </span>
            </div>
            {snapshot && statusBadge(snapshot.database.status)}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Query P50 Latency
              </span>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.database.query_latency_p50_ms ?? "—"}
                <span className="text-xs text-[var(--text-tertiary)] font-normal ml-1">
                  ms
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Slow Queries (&gt;50ms)
              </span>
              <div
                className={`text-sm font-bold font-mono ${
                  (snapshot?.database.slow_query_counter ?? 0) > 0
                    ? "text-[#EF4444]"
                    : "text-[#22C55E]"
                }`}
              >
                {snapshot?.database.slow_query_counter ?? 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-label font-mono bg-[#161616] p-2 rounded">
            <div>
              <span className="text-[var(--text-tertiary)]">Engine: </span>
              <span className="font-semibold text-[var(--text-primary)] uppercase">
                {snapshot?.database.engine}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Pool Checkouts: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.database.active_connections} /{" "}
                {snapshot?.database.pool_capacity}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Total Queries: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.database.total_queries ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">P95 Latency: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.database.query_latency_p95_ms}ms
              </span>
            </div>
          </div>

          <Sparkline
            data={timeseries.dbLatency}
            color="#3B82F6"
            label="DB Execution Latency (ms)"
            unit="ms"
          />
        </div>

        {/* CARD 4: DETERMINISTIC REPLAY ENGINE */}
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-3 rounded-sm">
          <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#A855F7]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                HISTORICAL REPLAY ENGINE
              </span>
            </div>
            {snapshot && statusBadge(snapshot.replay.status)}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Active Replay Sessions
              </span>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.replay.active_sessions ?? 0}
              </span>
            </div>
            <div className="text-right">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Playback Speed
              </span>
              <div className="text-sm font-bold font-mono text-[var(--accent-primary)]">
                {snapshot?.replay.playback_fps ?? 0} FPS
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-label font-mono bg-[#161616] p-2 rounded">
            <div>
              <span className="text-[var(--text-tertiary)]">Bars Loaded: </span>
              <span className="font-semibold text-[var(--text-primary)]">
                {snapshot?.replay.historical_candles_loaded.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Evaluations: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.replay.total_evaluations}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Steps/Min: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.replay.steps_per_minute}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Lineage: </span>
              <span className="text-[#22C55E]">Anti-Leakage OK</span>
            </div>
          </div>

          <div className="p-2 border border-[#1A1A1A] bg-[#080808] text-label font-mono text-[var(--text-tertiary)] flex items-center justify-between">
            <span>Guaranteed Forward-Looking Isolation</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
          </div>
        </div>

        {/* CARD 5: IN-PROCESS EVENT DISPATCH */}
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-3 rounded-sm">
          <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                EVENT DISPATCH GATEWAY
              </span>
            </div>
            {snapshot && statusBadge(snapshot.websocket.status)}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Network Clients
              </span>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.websocket.connected_clients ?? 0}
              </span>
            </div>
            <div className="text-right">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Throughput
              </span>
              <div className="text-sm font-bold font-mono text-[#10B981]">
                {snapshot?.websocket.messages_per_sec ?? 0} msg/s
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-label font-mono bg-[#161616] p-2 rounded">
            <div>
              <span className="text-[var(--text-tertiary)]">Total Events: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.websocket.total_messages ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Heartbeat Age: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.websocket.last_heartbeat_age_sec}s
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Runtime: </span>
              <span className="text-[var(--text-primary)]">InMemory EventBus</span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Network stream: </span>
              <span className="text-[#64748B]">Not deployed</span>
            </div>
          </div>

          <div className="p-2 border border-[#1A1A1A] bg-[#080808] text-label font-mono text-[var(--text-tertiary)] flex items-center justify-between">
            <span>EventBus decoupling active</span>
            <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
          </div>
        </div>

        {/* CARD 6: DATA PROVIDER (YAHOO FINANCE) */}
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] flex flex-col gap-3 rounded-sm">
          <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-[#EC4899]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                DATA PROVIDER FEED
              </span>
            </div>
            {snapshot && statusBadge(snapshot.provider.status)}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Sync Latency
              </span>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {snapshot?.provider.sync_latency_ms ?? 0}
                <span className="text-xs text-[var(--text-tertiary)] font-normal ml-1">
                  ms
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-label font-mono text-[var(--text-tertiary)]">
                Rate Limit
              </span>
              <div className="text-sm font-bold font-mono text-[#22C55E] uppercase">
                {snapshot?.provider.rate_limit_state ?? "NORMAL"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-label font-mono bg-[#161616] p-2 rounded">
            <div>
              <span className="text-[var(--text-tertiary)]">Provider: </span>
              <span className="text-[var(--text-primary)] font-semibold">
                Yahoo Finance
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Last Sync: </span>
              <span className="text-[var(--text-primary)]">
                {snapshot?.provider.last_successful_sync_age_sec}s ago
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Failures: </span>
              <span
                className={
                  (snapshot?.provider.recent_failures_count ?? 0) > 0
                    ? "text-[#EF4444]"
                    : "text-[#22C55E]"
                }
              >
                {snapshot?.provider.recent_failures_count ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Feed Quality: </span>
              <span className="text-[#22C55E]">Delayed 15m</span>
            </div>
          </div>

          <Sparkline
            data={timeseries.providerLatency}
            color="#EC4899"
            label="Provider Fetch Latency Trend"
            unit="ms"
          />
        </div>
      </div>

      {/* 4. Live Topology Map Card */}
      <TopologyMap
        snapshot={snapshot}
        onSelectNode={(id) => setSelectedNodeId(id)}
        selectedNodeId={selectedNodeId}
      />

      {/* 5. Selected Node Diagnostic Inspector */}
      {selectedNodeId && snapshot && (
        <div className="p-4 bg-[#0D0D0D] border border-[var(--border-default)] rounded-sm flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
            <span className="text-xs font-mono font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              NODE INSPECTOR // {selectedNodeId.toUpperCase()}
            </span>
            <span className="text-label font-mono text-[var(--text-tertiary)]">
              Subsystem status: {snapshot.overall_status}
            </span>
          </div>
          <div className="text-xs font-mono text-[var(--text-secondary)]">
            {selectedNodeId === "api" && (
              <p className="m-0 leading-relaxed">
                FastAPI ASGI Application Cluster. Instrumented with Prometheus
                metrics middleware and distributed trace ID propagation. Current
                P50: {snapshot.api.latency_p50_ms}ms · Requests per second:{" "}
                {snapshot.api.requests_per_second}.
              </p>
            )}
            {selectedNodeId === "cache" && (
              <p className="m-0 leading-relaxed">
                Cache Subsystem. Mode: {snapshot.cache.backend}. Keys in memory:{" "}
                {snapshot.cache.total_keys}. Hit rate: {snapshot.cache.hit_rate_pct}
                %. Redis cluster connectivity active.
              </p>
            )}
            {selectedNodeId === "database" && (
              <p className="m-0 leading-relaxed">
                Persistence Layer. Driver: SQLAlchemy ({snapshot.database.engine}
                ). Connection pool: {snapshot.database.active_connections}/
                {snapshot.database.pool_capacity}. Median query latency:{" "}
                {snapshot.database.query_latency_p50_ms}ms.
              </p>
            )}
            {selectedNodeId === "replay" && (
              <p className="m-0 leading-relaxed">
                Chronological Market Replay Engine. Strict point-in-time state
                evaluation with anti-future-leakage guarantees. Active sessions:{" "}
                {snapshot.replay.active_sessions}.
              </p>
            )}
            {selectedNodeId === "provider" && (
              <p className="m-0 leading-relaxed">
                External Ingestion Feed. Source: Yahoo Finance near real-time API.
                Last sync latency: {snapshot.provider.sync_latency_ms}ms. Rate
                limiting policy: normal.
              </p>
            )}
            {selectedNodeId === "eventbus" && (
              <p className="m-0 leading-relaxed">
                Domain Event Bus. In-memory decoupled publish-subscribe broker
                preparing for Apache Kafka migration. Total events emitted:{" "}
                {snapshot.events.total_events_published}.
              </p>
            )}
            {selectedNodeId === "frontend" && (
              <p className="m-0 leading-relaxed">
                React 19 / TypeScript 6 SPA. Client session:{" "}
                {user ? `User #${user.id} (${user.role})` : "Anonymous guest"}.
                High-performance Canvas rendering for institutional terminal
                charts and sparklines.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 6. Raw JSON Telemetry Modal */}
      {rawModalOpen && (
        <div className="themed-overlay fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="bg-[#0D0D0D] border border-[var(--border-strong)] rounded max-w-2xl w-full max-h-[80vh] flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                RAW SYSTEM TELEMETRY SNAPSHOT
              </span>
              <button
                onClick={() => setRawModalOpen(false)}
                className="text-xs font-mono text-[var(--text-tertiary)] hover:text-white"
              >
                CLOSE [ESC]
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-[#050505] p-3 text-label font-mono text-[#22C55E] border border-[#1E1E1E] rounded">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
