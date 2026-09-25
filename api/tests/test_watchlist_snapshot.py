"""Watchlist snapshot behavior with partial market data failures."""

from fastapi import HTTPException
import pytest

from api.services.watchlist_snapshot_service import build_watchlist_snapshot


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


def test_snapshot_rejects_unowned_list_before_fetching_quotes():
    with pytest.raises(HTTPException) as error:
        build_watchlist_snapshot(Lists(), Quotes(), 99)

    assert error.value.status_code == 404
