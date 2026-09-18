"""Regression coverage for API contracts repaired in the V0.8 stabilization."""

from api.core.dependencies import get_market_data_service
from api.main import app
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.tests.conftest import MockMarketProvider


def _register(client, email: str = "contract@example.com") -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"name": "Contract Test", "email": email, "password": "StrongPass1!"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _journal_entry(client, headers: dict[str, str]) -> int:
    response = client.post(
        "/journal",
        headers=headers,
        json={
            "symbol": "RELIANCE.NS",
            "action": "WATCH",
            "thesis": "Testing the repaired journal update contract.",
            "context_snapshot": {},
        },
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_journal_patch_and_put_compatibility(client):
    headers = _register(client)
    entry_id = _journal_entry(client, headers)

    patched = client.patch(
        f"/journal/{entry_id}",
        headers=headers,
        json={"status": "CLOSED"},
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "CLOSED"

    replaced = client.put(
        f"/journal/{entry_id}",
        headers=headers,
        json={"thesis": "Updated through the compatibility method."},
    )
    assert replaced.status_code == 200
    assert replaced.json()["thesis"] == "Updated through the compatibility method."


def test_replay_jump_uses_resolved_dictionary_step(client):
    candles = [
        {
            "time": f"2026-01-{index + 1:02d}",
            "open": 100.0 + index,
            "high": 102.0 + index,
            "low": 99.0 + index,
            "close": 101.0 + index,
            "volume": 1000 + index,
        }
        for index in range(8)
    ]
    provider = MockMarketProvider()
    provider.get_ohlc = lambda symbol, period="1mo", interval="1d": candles
    service = MarketDataService(provider, InMemoryCacheService())
    app.dependency_overrides[get_market_data_service] = lambda: service

    response = client.get("/replay/jump/RELIANCE.NS?timestamp=2026-01-04&period=1mo")

    assert response.status_code == 200
    assert response.json()["current_step"] == 3
    assert response.json()["current_candle"]["time"] == "2026-01-04"


def test_replay_jump_clamps_outside_series(client):
    candles = [
        {
            "time": f"2026-01-{index + 1:02d}",
            "open": 100.0,
            "high": 102.0,
            "low": 99.0,
            "close": 101.0,
            "volume": 1000,
        }
        for index in range(5)
    ]
    provider = MockMarketProvider()
    provider.get_ohlc = lambda symbol, period="1mo", interval="1d": candles
    service = MarketDataService(provider, InMemoryCacheService())
    app.dependency_overrides[get_market_data_service] = lambda: service

    before = client.get("/replay/jump/RELIANCE.NS?timestamp=2025-12-01&period=1mo")
    after = client.get("/replay/jump/RELIANCE.NS?timestamp=2026-12-01&period=1mo")

    assert before.status_code == 200
    assert before.json()["current_step"] == 0
    assert after.status_code == 200
    assert after.json()["current_step"] == 4
