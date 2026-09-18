"""
tests/test_market_structure_api.py
──────────────────────────────────
Integration tests for the /market-structure endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.core.dependencies import get_market_data_service
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.tests.conftest import MockMarketProvider

client = TestClient(app)

MOCK_CANDLES = [
    {
        "time": f"2026-01-{i+1:02d}",
        "open": 100.0 + i,
        "high": 105.0 + i,
        "low": 95.0 + i,
        "close": 102.0 + i,
        "volume": 1000.0 + (i * 50),
    }
    for i in range(30)
]


@pytest.fixture
def mock_provider():
    provider = MockMarketProvider()
    provider.get_ohlc = lambda symbol, period="1mo", interval="1d": MOCK_CANDLES
    service = MarketDataService(provider, InMemoryCacheService())
    app.dependency_overrides[get_market_data_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_market_data_service, None)


def test_support_resistance_endpoint(mock_provider):
    res = client.get("/support-resistance/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert "symbol" in data
    assert "support_zones" in data
    assert "resistance_zones" in data


def test_volume_endpoint(mock_provider):
    res = client.get("/volume/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert "rvol" in data
    assert "volume_state" in data
    assert "price_volume_relationship" in data


def test_moving_averages_endpoint(mock_provider):
    res = client.get("/moving-averages/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert "sma_20" in data
    assert "ema_9" in data
    assert "series" in data


def test_market_regime_endpoint(mock_provider):
    res = client.get("/market-regime/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert "regime" in data
    assert "reasons" in data
    assert len(data["reasons"]) > 0


def test_signal_alignment_endpoint(mock_provider):
    res = client.get("/signal-alignment/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert "bullish_alignment_count" in data
    assert "alignment_total" in data
    assert "dominant_bias" in data
    assert "conditions" in data


def test_unified_market_structure_summary(mock_provider):
    res = client.get("/market-structure/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    assert "support_resistance" in data
    assert "volume" in data
    assert "moving_averages" in data
    assert "market_regime" in data
    assert "signal_alignment" in data
    assert "detected_patterns" in data


def test_patterns_endpoint_backward_compat(mock_provider):
    res = client.get("/patterns/RELIANCE.NS")
    assert res.status_code == 200
    data = res.json()
    # Backward compat fields
    assert "latest_candle" in data
    assert "pattern" in data
    # New V2 fields
    assert "detected_patterns" in data
