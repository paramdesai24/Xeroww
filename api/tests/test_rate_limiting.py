"""
api/tests/test_rate_limiting.py
───────────────────────────────
Tests for application rate limiting middleware.
"""

import pytest
from starlette.testclient import TestClient
from api.main import app
from api.services.cache_service import get_cache_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_testclient_rate_limit():
    cache = get_cache_service()
    cache.delete("ratelimit:ip:testclient")
    yield
    cache.delete("ratelimit:ip:testclient")


def test_rate_limit_headers_present():
    res = client.get("/stocks")
    assert res.status_code == 200
    assert "X-RateLimit-Limit" in res.headers
    assert "X-RateLimit-Remaining" in res.headers


def test_rate_limit_exceeded_triggers_429():
    cache = get_cache_service()
    ip_key = "ratelimit:ip:testclient"
    cache.set(ip_key, 999, ttl_seconds=60)

    try:
        res = client.get("/stocks")
        assert res.status_code == 429
        assert res.headers.get("Retry-After") == "60"
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    finally:
        cache.delete(ip_key)
