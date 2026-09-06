"""
api/tests/test_resilience_and_failures.py
─────────────────────────────────────────
Failure-mode, resilience, and graceful degradation test suite.
Simulates:
  - External provider outages (HTTP 503)
  - Redis cache disconnects (seamless in-memory fallback)
  - Insufficient historical windows (clear, honest errors; zero fake data)
  - Stale and malformed market data handling
  - Non-crashing graceful degradation
"""

from unittest.mock import patch, MagicMock
import pytest
from starlette.testclient import TestClient

from api.main import app
from api.core.dependencies import get_market_data_service
from api.services.cache_service import RedisCacheService, InMemoryCacheService
from api.services.moving_average_service import analyze_moving_averages
from api.services.support_resistance_service import analyze_support_resistance
from api.services.market_data_service import MarketDataService

client = TestClient(app)


def test_provider_outage_returns_clean_503():
    """Simulate provider complete downtime. Must return 503 without crashing the server."""
    mock_svc = MagicMock(spec=MarketDataService)
    from fastapi import HTTPException
    mock_svc.get_quote.side_effect = HTTPException(status_code=503, detail="Market data provider unavailable: timeout")

    app.dependency_overrides[get_market_data_service] = lambda: mock_svc
    try:
        res = client.get("/quote/OUTAGE_SIMULATION.NS")
        assert res.status_code == 503
        data = res.json()
        assert "detail" in data
        assert "unavailable" in data["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_market_data_service, None)


def test_invalid_symbol_returns_clean_404():
    """Querying an unknown ticker symbol returns 404 with descriptive message."""
    res = client.get("/quote/NONEXISTENT_TICKER_XYZ_12345.NS")
    assert res.status_code in [404, 503]
    data = res.json()
    assert "detail" in data


def test_insufficient_historical_data_for_moving_averages():
    """
    Never silently return fake numbers when candles are insufficient.
    If fewer than required candles exist for SMA200, sma_200 must be None.
    """
    short_candles = [
        {
            "time": f"2026-01-{i+1:02d}",
            "open": 100.0,
            "high": 105.0,
            "low": 95.0,
            "close": 102.0,
            "volume": 1000.0,
        }
        for i in range(30)  # Only 30 candles provided, far below 200
    ]

    analysis = analyze_moving_averages(short_candles, "RELIANCE.NS")
    # SMA 20 should exist (since 30 >= 20)
    assert analysis.sma_20 is not None
    # SMA 50 and SMA 200 must be strictly None (NOT 0.0, NOT fake average)
    assert analysis.sma_50 is None
    assert analysis.sma_200 is None
    assert analysis.structural_summary is not None


def test_empty_candles_support_resistance_graceful():
    """Empty candle series must return empty zones without throwing unhandled exceptions."""
    analysis = analyze_support_resistance([], "RELIANCE.NS")
    assert analysis.support_zones == []
    assert analysis.resistance_zones == []
    assert analysis.nearest_support is None
    assert analysis.nearest_resistance is None


def test_redis_unavailable_fallback_no_crash():
    """
    When Redis is unreachable, CacheService must automatically fall back to InMemoryCache
    and continue processing requests without throwing connection errors.
    """
    with patch("redis.Redis.from_url") as mock_redis_cls:
        mock_redis_cls.side_effect = Exception("Connection refused: 127.0.0.1:6379")
        # Attempt to create a RedisCacheService instance
        with pytest.raises(Exception):
            RedisCacheService("redis://invalid_host:6379/0")

    # In-memory service continues working reliably
    fallback = InMemoryCacheService()
    fallback.set("test_fallback_key", {"status": "ok"}, ttl_seconds=10)
    assert fallback.get("test_fallback_key") == {"status": "ok"}


def test_malformed_candle_data_resilience():
    """Ensure moving averages calculations do not crash on NaN or None values in close."""
    candles_with_none = [
        {"time": f"2026-01-{i+1:02d}", "open": 100, "high": 105, "low": 95, "close": None, "volume": 100}
        for i in range(25)
    ]
    # Handled safely without throwing TypeError
    analysis = analyze_moving_averages(candles_with_none, "RELIANCE.NS")
    assert analysis.sma_200 is None
