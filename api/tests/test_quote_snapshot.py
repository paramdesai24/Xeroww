"""Public quote snapshot input and partial failure behavior."""

from fastapi import HTTPException

from api.core.dependencies import get_market_data_service
from api.main import app
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.tests.conftest import MockMarketProvider


def test_quote_snapshot_deduplicates_and_preserves_order(client):
    response = client.get("/quotes?symbols=TCS.NS,RELIANCE.NS,TCS.NS")
    assert response.status_code == 200
    rows = response.json()["rows"]
    assert [row["symbol"] for row in rows] == ["TCS.NS", "RELIANCE.NS"]
    assert all(row["available"] and row["quote"]["price"] > 0 for row in rows)


def test_quote_snapshot_rejects_unsupported_symbol(client):
    response = client.get("/quotes?symbols=RELIANCE.NS,UNKNOWN.NS")
    assert response.status_code == 422


def test_quote_snapshot_keeps_successful_rows_when_one_provider_call_fails(client):
    class PartialProvider(MockMarketProvider):
        def get_quote(self, symbol):
            if symbol == "TCS.NS":
                raise RuntimeError("provider unavailable")
            return super().get_quote(symbol)

    app.dependency_overrides[get_market_data_service] = lambda: MarketDataService(
        PartialProvider(), InMemoryCacheService()
    )
    response = client.get("/quotes?symbols=RELIANCE.NS,TCS.NS")
    assert response.status_code == 200
    rows = response.json()["rows"]
    assert rows[0]["available"] is True
    assert rows[1]["available"] is False
    assert rows[1]["quote"] is None
    assert "provider unavailable" not in rows[1]["reason"]


def test_quote_service_temporarily_caches_provider_failure():
    class FailingProvider(MockMarketProvider):
        calls = 0

        def get_quote(self, symbol):
            self.calls += 1
            raise RuntimeError("provider unavailable")

    provider = FailingProvider()
    market = MarketDataService(provider, InMemoryCacheService())
    for _ in range(2):
        try:
            market.get_quote("RELIANCE.NS")
        except HTTPException as error:
            assert error.status_code == 503
    assert provider.calls == 1
