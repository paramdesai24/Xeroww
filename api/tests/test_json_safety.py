"""Regression tests for non-finite market and API values."""

import json
import math

import pytest
from fastapi import HTTPException

from api.core.json_safety import sanitize_for_json
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService


class NonFiniteProvider:
    def normalize_symbol(self, symbol: str) -> str:
        return symbol.upper()

    def get_ohlc(self, symbol: str, period: str, interval: str):
        return [
            {"time": "2026-01-01", "open": 100, "high": 102, "low": 99, "close": 101, "volume": math.nan},
            {"time": "2026-01-02", "open": math.nan, "high": 103, "low": 100, "close": 102, "volume": 1000},
            {"time": "2026-01-03", "open": 102, "high": 104, "low": 101, "close": 103, "volume": 1100},
        ]


class InvalidProvider(NonFiniteProvider):
    def get_ohlc(self, symbol: str, period: str, interval: str):
        return [{"time": "2026-01-01", "open": math.inf, "high": 1, "low": 1, "close": 1, "volume": 1}]


def test_sanitize_for_json_replaces_nested_non_finite_values():
    payload = sanitize_for_json({"nan": math.nan, "items": [1.0, math.inf, -math.inf]})

    assert payload == {"nan": None, "items": [1.0, None, None]}
    assert json.dumps(payload, allow_nan=False)


def test_market_data_service_filters_bad_candles_and_volume():
    service = MarketDataService(NonFiniteProvider(), InMemoryCacheService())

    _, candles = service.get_candles("RELIANCE.NS")

    assert len(candles) == 2
    assert candles[0]["time"] == "2026-01-01"
    assert candles[0]["volume"] == 0
    assert candles[1]["time"] == "2026-01-03"


def test_market_data_service_rejects_an_entirely_invalid_series():
    service = MarketDataService(InvalidProvider(), InMemoryCacheService())

    with pytest.raises(HTTPException) as error:
        service.get_candles("RELIANCE.NS")

    assert error.value.status_code == 503
    assert "No valid OHLC data" in str(error.value.detail)
