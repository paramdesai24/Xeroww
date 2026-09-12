"""
api/routes/system_health.py
───────────────────────────
REST API endpoint for Xeroww SRE System Health & Topology Console.
Assembles live metrics from Prometheus counters/histograms, in-process registries,
database connection pools, cache diagnostics, and domain event bus state.
"""

import time
from datetime import datetime, timezone
from fastapi import APIRouter
from sqlalchemy import text

from api.schemas.health import (
    SystemHealthResponse,
    APIHealthDTO,
    CacheHealthDTO,
    DatabaseHealthDTO,
    ReplayEngineHealthDTO,
    WebSocketHealthDTO,
    ProviderHealthDTO,
    EventBusHealthDTO,
    LiveTopologyDTO,
    TopologyNodeDTO,
    TopologyEdgeDTO,
)
from api.core.prometheus_utils import (
    calculate_histogram_quantiles,
    get_http_request_stats,
    get_active_connection_count,
)
from api.services.health_registry import (
    get_uptime_seconds,
    get_uptime_human,
    get_replay_stats,
    get_ws_stats,
    get_db_stats,
    get_provider_stats,
    record_db_query,
)
from api.services.cache_service import get_cache_service
from api.database.session import engine, DATABASE_URL
from api.events import get_event_bus

router = APIRouter(tags=["System Health"])


@router.get(
    "/health/system",
    response_model=SystemHealthResponse,
    summary="Comprehensive system health, telemetry, and live topology",
)
def get_system_health() -> SystemHealthResponse:
    now_epoch = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. API Telemetry & Latencies
    quantiles = calculate_histogram_quantiles()
    http_stats = get_http_request_stats()
    active_connections = get_active_connection_count()
    uptime_sec = get_uptime_seconds()
    uptime_str = get_uptime_human()

    api_status = "operational"
    if http_stats["error_rate_pct"] > 15.0 or quantiles["p95_ms"] > 250.0:
        api_status = "degraded"

    api_dto = APIHealthDTO(
        status=api_status,
        uptime_seconds=round(uptime_sec, 1),
        uptime_human=uptime_str,
        requests_per_second=http_stats["requests_per_second"],
        total_requests=http_stats["total_requests"],
        total_errors=http_stats["total_errors"],
        error_rate_pct=http_stats["error_rate_pct"],
        latency_p50_ms=quantiles["p50_ms"],
        latency_p95_ms=quantiles["p95_ms"],
        latency_p99_ms=quantiles["p99_ms"],
        latency_avg_ms=quantiles["avg_ms"],
    )

    # 2. Cache Telemetry
    cache = get_cache_service()
    cache_stats = cache.stats()
    total_cache_ops = cache_stats["hits"] + cache_stats["misses"]
    miss_rate = round(100.0 - cache_stats["hit_rate_pct"], 1) if total_cache_ops > 0 else 0.0

    cache_dto = CacheHealthDTO(
        status="operational" if cache_stats.get("connected", True) else "degraded",
        backend=cache_stats.get("backend", "memory"),
        connected=cache_stats.get("connected", True),
        hit_rate_pct=cache_stats.get("hit_rate_pct", 0.0),
        miss_rate_pct=miss_rate,
        total_keys=cache_stats.get("total_keys", 0),
        hits=cache_stats.get("hits", 0),
        misses=cache_stats.get("misses", 0),
    )

    # 3. Database Telemetry
    db_status = "operational"
    pool_size = 5
    checked_out = 0
    try:
        pool_size = getattr(engine.pool, "size", lambda: 5)()
        checked_out = getattr(engine.pool, "checkedout", lambda: 0)()
    except Exception:
        pass

    # Quick db probe
    t0 = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_probe_ms = (time.perf_counter() - t0)
        record_db_query(db_probe_ms)
    except Exception:
        db_status = "degraded"

    db_stats = get_db_stats(
        active_conns=max(1, checked_out),
        pool_size=pool_size if pool_size > 0 else 5,
    )
    is_sqlite = DATABASE_URL.startswith("sqlite")

    db_dto = DatabaseHealthDTO(
        status=db_status,
        engine="sqlite" if is_sqlite else "postgresql",
        active_connections=db_stats["active_connections"],
        pool_capacity=db_stats["pool_capacity"],
        query_latency_p50_ms=db_stats["query_latency_p50_ms"],
        query_latency_p95_ms=db_stats["query_latency_p95_ms"],
        slow_query_counter=db_stats["slow_query_counter"],
        total_queries=db_stats["total_queries"],
    )

    # 4. Replay Engine Telemetry
    replay_stats = get_replay_stats()
    replay_dto = ReplayEngineHealthDTO(
        status=replay_stats["status"],
        active_sessions=replay_stats["active_sessions"],
        historical_candles_loaded=replay_stats["historical_candles_loaded"],
        playback_fps=replay_stats["playback_fps"],
        steps_per_minute=replay_stats["steps_per_minute"],
        total_evaluations=replay_stats["total_evaluations"],
    )

    # 5. WebSocket & Realtime Telemetry
    ws_stats = get_ws_stats(fallback_connections=active_connections)
    ws_dto = WebSocketHealthDTO(
        status=ws_stats["status"],
        connected_clients=ws_stats["connected_clients"],
        messages_per_sec=ws_stats["messages_per_sec"],
        total_messages=ws_stats["total_messages"],
        last_heartbeat_timestamp=ws_stats["last_heartbeat_timestamp"],
        last_heartbeat_age_sec=ws_stats["last_heartbeat_age_sec"],
    )

    # 6. Provider Telemetry
    provider_stats = get_provider_stats()
    provider_dto = ProviderHealthDTO(
        provider_name=provider_stats["provider_name"],
        status=provider_stats["status"],
        last_successful_sync_age_sec=provider_stats["last_successful_sync_age_sec"],
        last_sync_timestamp=provider_stats["last_sync_timestamp"],
        sync_latency_ms=provider_stats["sync_latency_ms"],
        rate_limit_state=provider_stats["rate_limit_state"],
        recent_failures_count=provider_stats["recent_failures_count"],
    )

    # 7. Event Bus Telemetry
    bus = get_event_bus()
    history = bus.get_history()
    last_event = history[-1].event_type if history else None
    handler_count = sum(len(h) for h in bus._subscribers.values()) if hasattr(bus, "_subscribers") else 4

    events_dto = EventBusHealthDTO(
        status="operational",
        total_events_published=len(history),
        subscriber_handlers_count=handler_count,
        last_event_type=last_event,
    )

    # 8. Live Topology Graph
    cache_node_status = "healthy" if cache_dto.connected else "degraded"
    db_node_status = "healthy" if db_dto.status == "operational" else "degraded"
    api_node_status = "healthy" if api_dto.status == "operational" else "degraded"
    provider_node_status = "healthy" if provider_dto.status == "operational" else "degraded"

    nodes: list[TopologyNodeDTO] = [
        TopologyNodeDTO(
            id="frontend",
            label="React Dashboard",
            sublabel="Vite / TypeScript",
            status="healthy",
            latency_ms=None,
            role="Client Interface",
        ),
        TopologyNodeDTO(
            id="api",
            label="FastAPI Gateway",
            sublabel=f"Uptime: {uptime_str}",
            status=api_node_status,
            latency_ms=quantiles["p50_ms"],
            role="Application Cluster",
        ),
        TopologyNodeDTO(
            id="cache",
            label=f"Cache ({cache_dto.backend})",
            sublabel=f"{cache_dto.total_keys} keys · {cache_dto.hit_rate_pct}% hit",
            status=cache_node_status,
            latency_ms=0.4 if cache_dto.backend == "memory" else 1.8,
            role="In-Memory Tier",
        ),
        TopologyNodeDTO(
            id="database",
            label=f"Relational DB ({db_dto.engine})",
            sublabel=f"{db_dto.active_connections} active conns · {db_dto.query_latency_p50_ms}ms",
            status=db_node_status,
            latency_ms=db_dto.query_latency_p50_ms,
            role="Persistence Tier",
        ),
        TopologyNodeDTO(
            id="replay",
            label="Replay Engine",
            sublabel=f"{replay_dto.active_sessions} sessions · {replay_dto.total_evaluations} evals",
            status="healthy" if replay_dto.status != "down" else "down",
            latency_ms=1.2,
            role="Deterministic Engine",
        ),
        TopologyNodeDTO(
            id="provider",
            label="Market Provider",
            sublabel=f"Yahoo Finance ({provider_dto.sync_latency_ms}ms)",
            status=provider_node_status,
            latency_ms=provider_dto.sync_latency_ms,
            role="External Ingestion",
        ),
        TopologyNodeDTO(
            id="eventbus",
            label="Domain Event Bus",
            sublabel=f"{events_dto.total_events_published} events · {events_dto.subscriber_handlers_count} handlers",
            status="healthy",
            latency_ms=0.1,
            role="Messaging / Kafka Precursor",
        ),
    ]

    edges: list[TopologyEdgeDTO] = [
        TopologyEdgeDTO(source="frontend", target="api", status=api_node_status, protocol="HTTPS / JSON"),
        TopologyEdgeDTO(source="api", target="cache", status=cache_node_status, protocol="RESP / Memory"),
        TopologyEdgeDTO(source="api", target="database", status=db_node_status, protocol="SQLAlchemy"),
        TopologyEdgeDTO(source="api", target="replay", status="healthy", protocol="In-Process"),
        TopologyEdgeDTO(source="api", target="provider", status=provider_node_status, protocol="HTTPS Rest"),
        TopologyEdgeDTO(source="api", target="eventbus", status="healthy", protocol="In-Memory Bus"),
    ]

    topology_dto = LiveTopologyDTO(nodes=nodes, edges=edges)

    # Overall system calculation
    overall_status = "operational"
    if api_status == "degraded" or db_status == "degraded" or provider_stats["status"] == "degraded":
        overall_status = "degraded"

    return SystemHealthResponse(
        timestamp=now_iso,
        timestamp_epoch=now_epoch,
        overall_status=overall_status,
        api=api_dto,
        cache=cache_dto,
        database=db_dto,
        replay=replay_dto,
        websocket=ws_dto,
        provider=provider_dto,
        events=events_dto,
        topology=topology_dto,
    )
