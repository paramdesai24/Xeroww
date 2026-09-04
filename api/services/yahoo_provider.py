"""
services/yahoo_provider.py
───────────────────────────
YahooFinanceProvider — Concrete implementation of MarketDataProvider using yfinance.

This is the ONLY file in Xeroww that imports yfinance.
Replacing this file (with a KafkaMarketProvider, for example) upgrades the entire data layer.
"""

from datetime import datetime
from typing import Any

import yfinance as yf

from api.services.market_provider import MarketDataProvider


# ---------------------------------------------------------------------------
# Watchlist — The Xeroww V0 predefined Indian stock universe
# ---------------------------------------------------------------------------
WATCHLIST: list[dict[str, str]] = [
    {"symbol": "RELIANCE.NS", "display_name": "Reliance Industries",   "exchange": "NSE", "sector": "Energy / Conglomerates"},
    {"symbol": "TCS.NS",      "display_name": "Tata Consultancy Services", "exchange": "NSE", "sector": "Information Technology"},
    {"symbol": "INFY.NS",     "display_name": "Infosys",               "exchange": "NSE", "sector": "Information Technology"},
    {"symbol": "HDFCBANK.NS", "display_name": "HDFC Bank",             "exchange": "NSE", "sector": "Banking & Financial Services"},
    {"symbol": "ICICIBANK.NS","display_name": "ICICI Bank",            "exchange": "NSE", "sector": "Banking & Financial Services"},
]

# Build a quick lookup map
SYMBOL_META: dict[str, dict[str, str]] = {s["symbol"]: s for s in WATCHLIST}


class YahooFinanceProvider(MarketDataProvider):
    """
    Fetches near real-time (delayed) market data from Yahoo Finance via yfinance.

    Data note: Yahoo Finance provides delayed data (typically 15–20 minutes for NSE).
               This is NOT live tick data.
    """

    def get_stocks(self) -> list[dict[str, Any]]:
        """Return the predefined Xeroww watchlist."""
        return WATCHLIST

    def get_quote(self, symbol: str) -> dict[str, Any]:
        """
        Fetch the latest quote for the symbol using yfinance fast_info.

        Args:
            symbol: Ticker with .NS suffix (e.g., "RELIANCE.NS")

        Returns:
            Dict matching QuoteResponse schema.

        Raises:
            ValueError: If symbol is not on the watchlist.
            RuntimeError: If yfinance fails to return valid data.
        """
        self._validate_symbol(symbol)
        meta = SYMBOL_META[symbol]

        ticker = yf.Ticker(symbol)
        info = ticker.fast_info

        try:
            price = float(info.last_price)
            prev_close = float(info.previous_close)
            day_high = float(info.day_high)
            day_low = float(info.day_low)
            volume = int(info.last_volume)
            market_cap = float(info.market_cap) if info.market_cap else None
        except (AttributeError, TypeError, ValueError) as exc:
            raise RuntimeError(
                f"Failed to fetch quote for {symbol}. "
                f"Yahoo Finance may be throttling requests or the market is closed. "
                f"Details: {exc}"
            ) from exc

        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0

        return {
            "symbol": symbol,
            "display_name": meta["display_name"],
            "price": round(price, 2),
            "previous_close": round(prev_close, 2),
            "change": change,
            "change_pct": change_pct,
            "day_high": round(day_high, 2),
            "day_low": round(day_low, 2),
            "volume": volume,
            "market_cap": market_cap,
            "currency": "INR",
            "data_note": "Near real-time data — Yahoo Finance delayed feed",
            "timestamp": datetime.utcnow(),
        }

    def get_ohlc(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> list[dict[str, Any]]:
        """
        Fetch historical OHLCV candles from Yahoo Finance.

        Args:
            symbol:   Ticker with .NS suffix
            period:   yfinance period string (e.g., "1mo", "3mo", "6mo", "1y")
            interval: Candle interval (e.g., "1d", "1wk")

        Returns:
            List of OHLCBar dicts sorted oldest → newest.
            Time is formatted as "YYYY-MM-DD" for TradingView Lightweight Charts.

        Raises:
            ValueError: If symbol is not on the watchlist.
            RuntimeError: If yfinance returns empty data.
        """
        self._validate_symbol(symbol)

        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)

        if df.empty:
            raise RuntimeError(
                f"No OHLC data returned for {symbol} "
                f"(period={period}, interval={interval}). "
                "The market may be closed or the symbol may be invalid."
            )

        candles: list[dict[str, Any]] = []
        for ts, row in df.iterrows():
            candles.append({
                "time": ts.strftime("%Y-%m-%d"),       # TradingView Lightweight Charts format
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        return candles  # Already sorted oldest → newest by yfinance

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    def _validate_symbol(self, symbol: str) -> None:
        """Raise ValueError if the symbol is not in the Xeroww watchlist."""
        if symbol not in SYMBOL_META:
            valid = ", ".join(SYMBOL_META.keys())
            raise ValueError(
                f"Symbol '{symbol}' is not in the Xeroww watchlist. "
                f"Valid symbols: {valid}"
            )
