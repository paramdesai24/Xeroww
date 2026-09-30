"""Focused tests for the market data provider and ingestion boundary."""

import asyncio
from datetime import datetime

from api.analytics import AnalyticsOrchestrator
from api.core.config import settings
from api.routes.ohlc import get_ohlc
from api.services import yahoo_provider
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.services.market_provider import (
    CandleRecord,
    InstrumentRecord,
    MarketDataProvider,
    MarketDataProviderMetadata,
    QuoteRecord,
)


class BoundaryProvider(MarketDataProvider):
    """Provider test double that has no Yahoo-specific behavior."""

    def __init__(self) -> None:
        self.quote_calls = 0
        self.ohlc_calls = 0

    @property
    def metadata(self) -> MarketDataProviderMetadata:
        return MarketDataProviderMetadata(provider_id="boundary", display_name="Boundary Feed")

    def normalize_symbol(self, symbol: str) -> str:
        return symbol.strip().upper()

    def get_instrument(self, symbol: str) -> InstrumentRecord:
        normalized = self.normalize_symbol(symbol)
        if normalized != "INDEX:TEST":
            raise ValueError(f"Unsupported instrument: {normalized}")
        return {
            "symbol": normalized,
            "display_name": "Test Market Index",
            "exchange": "TEST",
            "sector": "Broad Market Index",
        }

    def get_stocks(self) -> list[InstrumentRecord]:
        return []

    def get_quote(self, symbol: str) -> QuoteRecord:
        self.quote_calls += 1
        normalized = self.normalize_symbol(symbol)
        return {
            "symbol": normalized,
            "display_name": "Test Market Index",
            "price": 101.0,
            "previous_close": 100.0,
            "change": 1.0,
            "change_pct": 1.0,
            "day_high": 102.0,
            "day_low": 99.0,
            "volume": 1000,
            "market_cap": None,
            "currency": "INR",
            "data_note": "Boundary test data",
            "timestamp": datetime(2026, 1, 1),
        }

    def get_ohlc(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> list[CandleRecord]:
        self.ohlc_calls += 1
        return [
            {
                "time": "2026-01-01",
                "open": 100.0,
                "high": 102.0,
                "low": 99.0,
                "close": 101.0,
                "volume": 1000,
            }
        ]

    def get_benchmark_ohlc(
        self,
        symbol: str = "INDEX:TEST",
        period: str = "1y",
        interval: str = "1d",
    ) -> list[CandleRecord]:
        return self.get_ohlc(symbol, period, interval)


def test_service_exposes_provider_boundary_and_preserves_cache_semantics():
    provider = BoundaryProvider()
    cache = InMemoryCacheService()
    service = MarketDataService(provider, cache)

    assert service.normalize_symbol(" index:test ") == "INDEX:TEST"
    assert service.get_instrument("index:test")["display_name"] == "Test Market Index"

    first_quote = service.get_quote("index:test")
    second_quote = service.get_quote("INDEX:TEST")
    assert first_quote == second_quote
    assert provider.quote_calls == 1
    assert cache.get("quote:INDEX:TEST") == first_quote

    first_symbol, first_candles = service.get_candles("index:test")
    second_symbol, second_candles = service.get_candles("INDEX:TEST")
    assert first_symbol == second_symbol == "INDEX:TEST"
    assert first_candles == second_candles
    assert provider.ohlc_calls == 1
    assert cache.get("candles:INDEX:TEST:1mo:1d") == first_candles


def test_ohlc_route_resolves_metadata_through_provider_contract():
    provider = BoundaryProvider()
    service = MarketDataService(provider, InMemoryCacheService())

    response = asyncio.run(
        get_ohlc(
            symbol="index:test",
            period="1mo",
            interval="1d",
            market_data=service,
            orchestrator=AnalyticsOrchestrator(),
        )
    )

    assert response.symbol == "INDEX:TEST"
    assert response.display_name == "Test Market Index"
    assert response.candles[0].close == 101.0


def test_yahoo_adapter_exposes_provider_metadata_and_instrument_record(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "YFINANCE_CACHE_DIR", str(tmp_path / "yfinance"))
    monkeypatch.setattr(yahoo_provider, "_cache_is_configured", False)
    monkeypatch.setattr(yahoo_provider.yf, "set_tz_cache_location", lambda _: None)

    provider = yahoo_provider.YahooFinanceProvider()

    assert provider.metadata.provider_id == "yahoo"
    assert provider.get_instrument("^nsei") == {
        "symbol": "^NSEI",
        "display_name": "NIFTY 50",
        "exchange": "NSE",
        "sector": "Broad Market Index",
    }
