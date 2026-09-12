// src/types/health.ts
// Institutional TypeScript interfaces for Xeroww SRE Operations & System Health Console.
// Mirrors backend Pydantic DTOs with complete type safety.

export type SystemStatusLevel = "operational" | "degraded" | "down" | "idle";
export type NodeStatusLevel = "healthy" | "degraded" | "down";

export interface APIHealth {
  status: "operational" | "degraded" | "down";
  uptime_seconds: number;
  uptime_human: string;
  requests_per_second: number;
  total_requests: number;
  total_errors: number;
  error_rate_pct: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  latency_avg_ms: number;
}

export interface CacheHealth {
  status: "operational" | "degraded" | "down";
  backend: string;
  connected: boolean;
  hit_rate_pct: number;
  miss_rate_pct: number;
  total_keys: number;
  hits: number;
  misses: number;
}

export interface DatabaseHealth {
  status: "operational" | "degraded" | "down";
  engine: "sqlite" | "postgresql";
  active_connections: number;
  pool_capacity: number;
  query_latency_p50_ms: number;
  query_latency_p95_ms: number;
  slow_query_counter: number;
  total_queries: number;
}

export interface ReplayEngineHealth {
  status: "operational" | "degraded" | "idle";
  active_sessions: number;
  historical_candles_loaded: number;
  playback_fps: number;
  steps_per_minute: number;
  total_evaluations: number;
}

export interface WebSocketHealth {
  status: "operational" | "degraded" | "down";
  connected_clients: number;
  messages_per_sec: number;
  total_messages: number;
  last_heartbeat_timestamp: number;
  last_heartbeat_age_sec: number;
}

export interface ProviderHealth {
  provider_name: string;
  status: "operational" | "degraded" | "down";
  last_successful_sync_age_sec: number;
  last_sync_timestamp: number;
  sync_latency_ms: number;
  rate_limit_state: "normal" | "throttled" | "exceeded";
  recent_failures_count: number;
}

export interface EventBusHealth {
  status: "operational" | "degraded";
  total_events_published: number;
  subscriber_handlers_count: number;
  last_event_type: string | null;
}

export interface TopologyNode {
  id: string;
  label: string;
  sublabel: string;
  status: NodeStatusLevel;
  latency_ms: number | null;
  role: string;
}

export interface TopologyEdge {
  source: string;
  target: string;
  status: NodeStatusLevel;
  protocol: string;
}

export interface LiveTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface SystemHealthSnapshot {
  timestamp: string;
  timestamp_epoch: number;
  overall_status: "operational" | "degraded" | "down";
  api: APIHealth;
  cache: CacheHealth;
  database: DatabaseHealth;
  replay: ReplayEngineHealth;
  websocket: WebSocketHealth;
  provider: ProviderHealth;
  events: EventBusHealth;
  topology: LiveTopology;
}

export interface TelemetryTimeseries {
  timestamps: string[];
  apiP50: number[];
  apiP95: number[];
  reqRate: number[];
  cacheHitRate: number[];
  dbLatency: number[];
  providerLatency: number[];
}
