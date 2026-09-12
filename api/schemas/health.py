"""
api/schemas/health.py
────────────────────
Typed Pydantic Data Transfer Objects (DTOs) for the Xeroww SRE System Health & Telemetry Console.
Ensures rigid schema contracts across the API, Kafka telemetry streams, and React dashboard.
"""

from pydantic import BaseModel, Field
from typing import Literal


class APIHealthDTO(BaseModel):
    status: Literal["operational", "degraded", "down"] = "operational"
    uptime_seconds: float = Field(..., description="System uptime in seconds")
    uptime_human: str = Field(..., description="Human-readable uptime e.g. 2d 14h 32m")
    requests_per_second: float = Field(..., description="Calculated HTTP throughput")
    total_requests: int = Field(..., description="Total HTTP requests processed")
    total_errors: int = Field(..., description="Total 4xx and 5xx errors recorded")
    error_rate_pct: float = Field(..., description="Error rate percentage")
    latency_p50_ms: float = Field(..., description="P50 median latency in ms")
    latency_p95_ms: float = Field(..., description="P95 latency in ms")
    latency_p99_ms: float = Field(..., description="P99 peak latency in ms")
    latency_avg_ms: float = Field(..., description="Average latency in ms")


class CacheHealthDTO(BaseModel):
    status: Literal["operational", "degraded", "down"] = "operational"
    backend: str = Field(..., description="Cache implementation: redis or memory")
    connected: bool = Field(..., description="Whether Redis is actively connected")
    hit_rate_pct: float = Field(..., description="Cache hit rate percentage")
    miss_rate_pct: float = Field(..., description="Cache miss rate percentage")
    total_keys: int = Field(..., description="Active keys stored in cache")
    hits: int = Field(..., description="Total cache hits")
    misses: int = Field(..., description="Total cache misses")


class DatabaseHealthDTO(BaseModel):
    status: Literal["operational", "degraded", "down"] = "operational"
    engine: str = Field(..., description="sqlite or postgresql")
    active_connections: int = Field(..., description="Currently active checked-out connections")
    pool_capacity: int = Field(..., description="Maximum connection pool size")
    query_latency_p50_ms: float = Field(..., description="Median query latency in ms")
    query_latency_p95_ms: float = Field(..., description="P95 query latency in ms")
    slow_query_counter: int = Field(..., description="Queries exceeding slow threshold (50ms)")
    total_queries: int = Field(..., description="Total queries executed")


class ReplayEngineHealthDTO(BaseModel):
    status: Literal["operational", "degraded", "idle"] = "operational"
    active_sessions: int = Field(..., description="Active concurrent historical replay sessions")
    historical_candles_loaded: int = Field(..., description="Sum of candles loaded across sessions")
    playback_fps: float = Field(..., description="Calculated playback frames/steps per second")
    steps_per_minute: int = Field(..., description="Replay step evaluations in the last 60s")
    total_evaluations: int = Field(..., description="Total historical steps evaluated")


class WebSocketHealthDTO(BaseModel):
    status: Literal["operational", "degraded", "down"] = "operational"
    connected_clients: int = Field(..., description="Active client connections / WS subscribers")
    messages_per_sec: float = Field(..., description="Real-time message broadcast rate")
    total_messages: int = Field(..., description="Cumulative events dispatched to clients")
    last_heartbeat_timestamp: float = Field(..., description="Unix epoch of last heartbeat/pulse")
    last_heartbeat_age_sec: float = Field(..., description="Seconds since last heartbeat")


class ProviderHealthDTO(BaseModel):
    provider_name: str = "Yahoo Finance Feed"
    status: Literal["operational", "degraded", "down"] = "operational"
    last_successful_sync_age_sec: float = Field(..., description="Seconds since last successful quote/bar fetch")
    last_sync_timestamp: float = Field(..., description="Unix epoch of last sync probe")
    sync_latency_ms: float = Field(..., description="Round-trip latency of provider probe in ms")
    rate_limit_state: Literal["normal", "throttled", "exceeded"] = "normal"
    recent_failures_count: int = Field(..., description="Failed provider calls in recent window")


class EventBusHealthDTO(BaseModel):
    status: Literal["operational", "degraded"] = "operational"
    total_events_published: int = Field(..., description="Total events processed through EventBus")
    subscriber_handlers_count: int = Field(..., description="Total registered event handler callbacks")
    last_event_type: str | None = Field(None, description="Most recent DomainEvent type")


class TopologyNodeDTO(BaseModel):
    id: str
    label: str
    sublabel: str
    status: Literal["healthy", "degraded", "down"]
    latency_ms: float | None = None
    role: str


class TopologyEdgeDTO(BaseModel):
    source: str
    target: str
    status: Literal["healthy", "degraded", "down"]
    protocol: str


class LiveTopologyDTO(BaseModel):
    nodes: list[TopologyNodeDTO]
    edges: list[TopologyEdgeDTO]


class SystemHealthResponse(BaseModel):
    timestamp: str
    timestamp_epoch: float
    overall_status: Literal["operational", "degraded", "down"]
    api: APIHealthDTO
    cache: CacheHealthDTO
    database: DatabaseHealthDTO
    replay: ReplayEngineHealthDTO
    websocket: WebSocketHealthDTO
    provider: ProviderHealthDTO
    events: EventBusHealthDTO
    topology: LiveTopologyDTO
