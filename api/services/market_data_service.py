"""
api/services/market_data_service.py
───────────────────────────────────
Domain service for market data retrieval.
Consumes normalized market data from a MarketDataProvider abstraction
and provides clean, cached, error-handled access to routes and analytics engines.
"""

import math
from typing import Any
from fastapi import HTTPException, status

from api.core.config import settings
from api.services.market_provider import MarketDataProvider
from api.services.yahoo_provider import YahooFinanceProvider
from api.services.cache_service import get_cache_service, CacheService


class MarketDataService:
    def __init__(
        self,
        provider: MarketDataProvider | None = None,
        cache: CacheService | None = None,
    ):
        self.provider = provider or YahooFinanceProvider()
        self.cache = cache or get_cache_service()

    def get_stocks(self) -> list[dict[str, Any]]:
        cache_key = "stocks:nifty50:v1"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            stocks = self.provider.get_stocks()
            self.cache.set(cache_key, stocks, ttl_seconds=3600)  # 1 hour
            return stocks
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Market data provider unavailable: {exc}",
            )

    def get_quote(self, symbol: str) -> dict[str, Any]:
        normalized = self.provider.normalize_symbol(symbol)
        cache_key = f"quote:{normalized}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            quote = self.provider.get_quote(normalized)
            self.cache.set(cache_key, quote, ttl_seconds=settings.CACHE_QUOTE_TTL)
            return quote
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unexpected error fetching quote: {exc}")

    def get_candles(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> tuple[str, list[dict[str, Any]]]:
        normalized = self.provider.normalize_symbol(symbol)
        cache_key = f"candles:{normalized}:{period}:{interval}"
        try:
            cached = self.cache.get(cache_key)
            source = cached if cached else self.provider.get_ohlc(
                normalized,
                period=period,
                interval=interval,
            )
            candles = self._finite_candles(source)
            if not candles:
                raise RuntimeError(f"No valid OHLC data is available for '{normalized}'.")
            self.cache.set(cache_key, candles, ttl_seconds=settings.CACHE_OHLC_TTL)
            return normalized, candles
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unexpected error fetching OHLC: {exc}")

    @staticmethod
    def _finite_candles(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Drop unusable price rows and normalize invalid volume to zero."""
        result: list[dict[str, Any]] = []
        for candle in candles:
            try:
                prices = {
                    key: float(candle[key])
                    for key in ("open", "high", "low", "close")
                }
            except (KeyError, TypeError, ValueError):
                continue
            if not all(math.isfinite(value) for value in prices.values()):
                continue
            try:
                volume = float(candle.get("volume", 0))
            except (TypeError, ValueError):
                volume = 0.0
            if not math.isfinite(volume) or volume < 0:
                volume = 0.0
            result.append({
                **candle,
                **prices,
                "volume": int(volume),
            })
        return result

    def get_benchmark_candles(
        self,
        symbol: str = "^NSEI",
        period: str = "1y",
        interval: str = "1d",
    ) -> list[dict[str, Any]]:
        cache_key = f"benchmark:{symbol}:{period}:{interval}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        try:
            candles = self.provider.get_benchmark_ohlc(symbol, period=period, interval=interval)
            self.cache.set(cache_key, candles, ttl_seconds=settings.CACHE_OHLC_TTL)
            return candles
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Benchmark data unavailable: {exc}",
            ) from exc
