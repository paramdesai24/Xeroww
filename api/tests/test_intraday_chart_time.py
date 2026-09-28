"""Verify intraday chart timestamps survive the market data API."""

from api.core.dependencies import get_market_data_service
from api.main import app
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.tests.conftest import MockMarketProvider


def test_ohlc_returns_distinct_intraday_chart_times(client):
    candles = [
        {"time": "2026-09-28", "chart_time": 1790566800, "open": 100, "high": 102, "low": 99, "close": 101, "volume": 10},
        {"time": "2026-09-28", "chart_time": 1790567100, "open": 101, "high": 103, "low": 100, "close": 102, "volume": 12},
    ]
    provider = MockMarketProvider()
    provider.get_ohlc = lambda symbol, period="1d", interval="5m": candles
    app.dependency_overrides[get_market_data_service] = lambda: MarketDataService(provider, InMemoryCacheService())

    response = client.get("/ohlc/RELIANCE.NS?period=1d&interval=5m")

    assert response.status_code == 200
    assert [bar["chart_time"] for bar in response.json()["candles"]] == [1790566800, 1790567100]
