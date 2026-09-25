"""
services/market_provider.py
────────────────────────────
Abstract Base Class for all Xeroww market data providers.

All routes use this interface rather than importing a provider directly.
"""

from abc import ABC, abstractmethod
from typing import Any


class MarketDataProvider(ABC):
    """
    Abstract interface for all market data providers in the Xeroww platform.
    Any concrete implementation must fulfil this contract.
    """

    @abstractmethod
    def get_stocks(self) -> list[dict[str, Any]]:
        """
        Return the predefined watchlist of supported stock instruments.

        Returns:
            List of dicts with keys:
              - symbol (str): Ticker with exchange suffix (e.g., "RELIANCE.NS")
              - display_name (str): Human-readable company name
              - exchange (str): Exchange code (e.g., "NSE")
              - sector (str): Sector classification
        """
        ...

    @abstractmethod
    def get_quote(self, symbol: str) -> dict[str, Any]:
        """
        Retrieve the most recent market quote for a given symbol.

        Args:
            symbol: Ticker symbol with exchange suffix (e.g., "RELIANCE.NS")

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
    ) -> list[dict[str, Any]]:
        """
        Retrieve historical OHLCV candlestick data for a given symbol.

        Args:
            symbol:   Ticker symbol with exchange suffix
            period:   yfinance-compatible period string (e.g., "1mo", "3mo", "1y")
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
    ) -> list[dict[str, Any]]:
        """Return benchmark candles when supported by the provider."""
        raise NotImplementedError("This provider does not expose benchmark history.")
