"""
api/tests/test_system_health.py
───────────────────────────────
Unit and integration tests for Xeroww SRE System Health & Topology Console endpoint.
Validates schema contracts, quantile estimates, telemetry subsystems, and edge cases.
"""

from fastapi.testclient import TestClient
from api.main import app
from api.services.health_registry import (
    record_replay_access,
    record_ws_message,
    record_db_query,
    record_provider_sync,
)
from api.services.cache_service import get_cache_service

client = TestClient(app)


def test_system_health_endpoint_contract():
    """Verify that GET /health/system returns 200 with all typed sections."""
    resp = client.get("/health/system")
    assert resp.status_code == 200
    data = resp.json()

    # Core metadata
    assert "timestamp" in data
    assert "timestamp_epoch" in data
    assert data["overall_status"] in ["operational", "degraded", "down"]

    # Section: API
    api = data["api"]
    assert "uptime_seconds" in api
    assert "uptime_human" in api
    assert "latency_p50_ms" in api
    assert "latency_p95_ms" in api
    assert "latency_p99_ms" in api
    assert "requests_per_second" in api
    assert "error_rate_pct" in api

    # Section: Cache
    cache = data["cache"]
    assert cache["backend"] in ["redis", "memory"]
    assert "connected" in cache
    assert "hit_rate_pct" in cache
    assert "miss_rate_pct" in cache
    assert "total_keys" in cache

    # Section: Database
    db = data["database"]
    assert db["engine"] in ["sqlite", "postgresql"]
    assert "active_connections" in db
    assert "pool_capacity" in db
    assert "query_latency_p50_ms" in db
    assert "slow_query_counter" in db

    # Section: Replay
    replay = data["replay"]
    assert "active_sessions" in replay
    assert "historical_candles_loaded" in replay
    assert "playback_fps" in replay

    # Section: WebSocket
    ws = data["websocket"]
    assert "connected_clients" in ws
    assert "messages_per_sec" in ws

    # Section: Provider
    provider = data["provider"]
    assert "Yahoo Finance" in provider["provider_name"]
    assert "sync_latency_ms" in provider
    assert provider["rate_limit_state"] in ["normal", "throttled", "exceeded"]

    # Section: Event Bus
    events = data["events"]
    assert "total_events_published" in events
    assert "subscriber_handlers_count" in events

    # Section: Topology
    topo = data["topology"]
    assert "nodes" in topo
    assert "edges" in topo
    assert len(topo["nodes"]) >= 6
    assert len(topo["edges"]) >= 5


def test_health_registry_telemetry_updates():
    """Verify that simulating events updates the health registry."""
    # Simulate replay access
    record_replay_access("TEST.NS", 150, 10)
    # Simulate real-time ws message
    record_ws_message(5)
    # Simulate db query
    record_db_query(0.002)
    # Simulate provider sync
    record_provider_sync("Yahoo Finance Feed", 45.2, success=True)

    resp = client.get("/health/system")
    assert resp.status_code == 200
    data = resp.json()

    assert data["replay"]["active_sessions"] >= 1
    assert data["replay"]["historical_candles_loaded"] >= 150
    assert data["websocket"]["total_messages"] >= 5


def test_cache_hit_miss_accounting():
    """Verify that cache hits and misses are properly tracked in cache stats."""
    cache = get_cache_service()
    cache.set("sre_test_key", "val", ttl_seconds=10)
    assert cache.get("sre_test_key") == "val"
    assert cache.get("non_existent_key_12345") is None

    stats = cache.stats()
    assert stats["hits"] >= 1
    assert stats["misses"] >= 1
    assert stats["hit_rate_pct"] >= 0.0
