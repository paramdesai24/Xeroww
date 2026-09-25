"""Watchlist snapshot behavior with partial market data failures."""

from datetime import datetime
from fastapi import HTTPException
import pytest

from api.services.watchlist_snapshot_service import _quote_timestamp, build_watchlist_snapshot
from api.core.dependencies import get_market_data_service
from api.main import app


class Item:
    def __init__(self, item_id: int, symbol: str):
        self.id = item_id
        self.symbol = symbol


class OwnedList:
    id = 4
    name = "Focused"
    is_default = False
    items = [Item(2, "TCS.NS"), Item(1, "RELIANCE.NS")]


class Lists:
    def get_watchlist(self, watchlist_id: int):
        if watchlist_id != OwnedList.id:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        return OwnedList()


class Quotes:
    def get_quote(self, symbol: str):
        if symbol == "TCS.NS":
            raise RuntimeError("Provider unavailable")
        return {
            "price": 2500,
            "change": 25,
            "change_pct": 1,
            "display_name": "Reliance Industries",
            "timestamp": "2026-09-25T10:00:00Z",
        }


def test_snapshot_preserves_order_and_partial_success():
    result = build_watchlist_snapshot(Lists(), Quotes(), 4)

    assert [row.symbol for row in result.rows] == ["RELIANCE.NS", "TCS.NS"]
    assert result.rows[0].available is True
    assert result.rows[0].context == "Above previous close"
    assert result.rows[1].available is False
    assert result.rows[1].price is None
    assert result.rows[1].reason == "Market data is temporarily unavailable."


def test_naive_provider_time_is_normalized_to_utc():
    assert _quote_timestamp(datetime(2026, 9, 25, 10, 0)) == "2026-09-25T10:00:00+00:00"


def test_snapshot_rejects_unowned_list_before_fetching_quotes():
    with pytest.raises(HTTPException) as error:
        build_watchlist_snapshot(Lists(), Quotes(), 99)

    assert error.value.status_code == 404


def test_snapshot_route_requires_owner_and_keeps_partial_rows(client):
    def headers(email: str):
        client.post("/auth/register", json={"name": "Snapshot User", "email": email, "password": "SecurePass1"})
        login = client.post("/auth/login", json={"email": email, "password": "SecurePass1"})
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    owner = headers("snapshot_owner@test.io")
    outsider = headers("snapshot_other@test.io")
    created = client.post("/watchlists", json={"name": "Quotes"}, headers=owner)
    watchlist_id = created.json()["id"]
    for symbol in ("RELIANCE.NS", "TCS.NS"):
        assert client.post(f"/watchlists/{watchlist_id}/symbols", json={"symbol": symbol}, headers=owner).status_code == 201

    app.dependency_overrides[get_market_data_service] = lambda: Quotes()
    try:
        response = client.get(f"/watchlists/{watchlist_id}/snapshot", headers=owner)
        assert response.status_code == 200
        assert [row["available"] for row in response.json()["rows"]] == [True, False]
        assert client.get(f"/watchlists/{watchlist_id}/snapshot", headers=outsider).status_code == 404
    finally:
        app.dependency_overrides.pop(get_market_data_service, None)
