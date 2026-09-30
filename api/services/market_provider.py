"""
services/market_provider.py
────────────────────────────
Abstract Base Class for all Xeroww market data providers.

All routes use this interface rather than importing a provider directly.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import NotRequired, TypedDict


@dataclass(frozen=True)
class MarketDataProviderMetadata:
    """Stable identity for a market data adapter."""

    provider_id: str
    display_name: str


class InstrumentRecord(TypedDict):
    """Application representation of a supported market instrument."""

    symbol: str
    display_name: str
    exchange: str
    sector: str


class QuoteRecord(TypedDict):
    """Application representation of a current market quote."""

    symbol: str
    display_name: str
    price: float
    previous_close: float
    change: float
    change_pct: float
    day_high: float
    day_low: float
    volume: int
    market_cap: float | None
    currency: str
    data_note: str
    timestamp: datetime | str


class CandleRecord(TypedDict):
    """Application representation of one OHLCV observation."""

    time: str
    chart_time: NotRequired[int]
    open: float
    high: float
    low: float
    close: float
    volume: int


class MarketDataProvider(ABC):
    """
    Abstract interface for all market data providers in the Xeroww platform.
    Any concrete implementation must fulfil this contract.
    """

    @property
    @abstractmethod
    def metadata(self) -> MarketDataProviderMetadata:
        """Return stable identity metadata for this adapter."""
        ...

    @abstractmethod
    def normalize_symbol(self, symbol: str) -> str:
        """Return the canonical application symbol for an input symbol."""
        ...

    @abstractmethod
    def get_instrument(self, symbol: str) -> InstrumentRecord:
        """Return canonical metadata for a supported instrument."""
        ...

    @abstractmethod
    def get_stocks(self) -> list[InstrumentRecord]:
        """
        Return the predefined watchlist of supported stock instruments.

        Returns:
            List of dicts with keys:
              - symbol (str): Canonical application ticker
              - display_name (str): Human-readable company name
              - exchange (str): Exchange code (e.g., "NSE")
              - sector (str): Sector classification
        """
        ...

    @abstractmethod
    def get_quote(self, symbol: str) -> QuoteRecord:
        """
        Retrieve the most recent market quote for a given symbol.

        Args:
            symbol: Canonical application ticker

        Returns:
            Dict matching QuoteResponse schema fields.
        """
        ...

    @abstractmethod
    def get_ohlc(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> list[CandleRecord]:
        """
        Retrieve historical OHLCV candlestick data for a given symbol.

        Args:
            symbol:   Canonical application ticker
            period:   Requested history window (e.g., "1mo", "3mo", "1y")
            interval: Candle interval (e.g., "1d", "1wk")

        Returns:
            List of dicts matching OHLCBar schema fields (time, open, high, low, close, volume).
            Sorted oldest → newest.
        """
        ...

    def get_benchmark_ohlc(
        self,
        symbol: str = "^NSEI",
        period: str = "1y",
        interval: str = "1d",
    ) -> list[CandleRecord]:
        """Return benchmark candles when supported by the provider."""
        raise NotImplementedError("This provider does not expose benchmark history.")
