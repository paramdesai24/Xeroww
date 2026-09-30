"""
services/yahoo_provider.py
───────────────────────────
YahooFinanceProvider — Concrete implementation of MarketDataProvider using yfinance.

This is the ONLY file in Xeroww that imports yfinance.
Replacing this file (with a KafkaMarketProvider, for example) upgrades the entire data layer.
"""

from datetime import datetime
from pathlib import Path
import threading
import yfinance as yf

from api.core.config import settings
from api.data.nifty50 import NIFTY50
from api.services.market_provider import (
    CandleRecord,
    InstrumentRecord,
    MarketDataProvider,
    MarketDataProviderMetadata,
    QuoteRecord,
)


_cache_setup_lock = threading.Lock()
_cache_is_configured = False


def _configure_yfinance_cache() -> None:
    """Configure yfinance to use a known writable cache directory once."""
    global _cache_is_configured
    if _cache_is_configured:
        return

    with _cache_setup_lock:
        if _cache_is_configured:
            return

        cache_dir = Path(settings.YFINANCE_CACHE_DIR).expanduser()
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            yf.set_tz_cache_location(str(cache_dir.resolve()))
        except (OSError, RuntimeError) as exc:
            raise RuntimeError(
                f"Unable to initialize Yahoo Finance cache at '{cache_dir}': {exc}"
            ) from exc

        _cache_is_configured = True


# ---------------------------------------------------------------------------
# Supported NIFTY 50 universe
# ---------------------------------------------------------------------------
WATCHLIST: list[dict[str, str]] = NIFTY50

# Build a quick lookup map
SYMBOL_META: dict[str, dict[str, str]] = {s["symbol"]: s for s in WATCHLIST}

INDEX_META: dict[str, dict[str, str]] = {
    "^NSEI": {
        "symbol": "^NSEI",
        "display_name": "NIFTY 50",
        "exchange": "NSE",
        "sector": "Broad Market Index",
    },
    "^BSESN": {
        "symbol": "^BSESN",
        "display_name": "SENSEX",
        "exchange": "BSE",
        "sector": "Broad Market Index",
    },
    "^NSEBANK": {
        "symbol": "^NSEBANK",
        "display_name": "NIFTY BANK",
        "exchange": "NSE",
        "sector": "Banking Index",
    },
    "^INDIAVIX": {
        "symbol": "^INDIAVIX",
        "display_name": "INDIA VIX",
        "exchange": "NSE",
        "sector": "Volatility Index",
    },
}


class YahooFinanceProvider(MarketDataProvider):
    """
    Fetches near real-time (delayed) market data from Yahoo Finance via yfinance.

    Data note: Yahoo Finance provides delayed data (typically 15–20 minutes for NSE).
               This is NOT live tick data.
    """

    def __init__(self) -> None:
        _configure_yfinance_cache()

    @property
    def metadata(self) -> MarketDataProviderMetadata:
        return MarketDataProviderMetadata(provider_id="yahoo", display_name="Yahoo Finance")

    def get_instrument(self, symbol: str) -> InstrumentRecord:
        normalized = self.normalize_symbol(symbol)
        self._validate_symbol(normalized)
        return SYMBOL_META.get(normalized) or INDEX_META[normalized]

    def get_stocks(self) -> list[InstrumentRecord]:
        """Return the supported NIFTY 50 constituent universe."""
        return WATCHLIST

    def get_quote(self, symbol: str) -> QuoteRecord:
        """
        Fetch the latest quote for the symbol using yfinance.
        Uses fast_info with automatic fallback to recent history for 100% reliability.

        Args:
            symbol: Ticker (e.g. "RELIANCE" or "RELIANCE.NS")

        Returns:
            Dict matching QuoteResponse schema.
        """
        symbol = self.normalize_symbol(symbol)
        self._validate_symbol(symbol)
        meta = SYMBOL_META.get(symbol) or INDEX_META[symbol]

        ticker = yf.Ticker(symbol)
        price, prev_close, day_high, day_low, volume, market_cap = None, None, None, None, 0, None

        # 1. Try fast_info
        try:
            info = ticker.fast_info
            if hasattr(info, "last_price") and info.last_price is not None:
                price = float(info.last_price)
                prev_close = float(info.previous_close) if info.previous_close else None
                day_high = float(info.day_high) if info.day_high else None
                day_low = float(info.day_low) if info.day_low else None
                volume = int(info.last_volume) if info.last_volume else 0
                market_cap = float(info.market_cap) if info.market_cap else None
        except Exception:
            pass

        # 2. Fallback to history if any essential metric is missing
        if price is None or prev_close is None:
            df = ticker.history(period="5d", interval="1d", auto_adjust=True)
            if df.empty:
                raise RuntimeError(
                    f"Failed to fetch market quote for {symbol}. No data returned from Yahoo Finance."
                )
            latest_row = df.iloc[-1]
            price = float(latest_row["Close"])
            day_high = float(latest_row["High"]) if day_high is None else day_high
            day_low = float(latest_row["Low"]) if day_low is None else day_low
            volume = int(latest_row["Volume"]) if not volume else volume

            if len(df) >= 2:
                prev_close = float(df.iloc[-2]["Close"])
            else:
                prev_close = float(latest_row["Open"])

        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0

        return {
            "symbol": symbol,
            "display_name": meta["display_name"],
            "price": round(price, 2),
            "previous_close": round(prev_close, 2),
            "change": change,
            "change_pct": change_pct,
            "day_high": round(day_high if day_high is not None else price, 2),
            "day_low": round(day_low if day_low is not None else price, 2),
            "volume": volume,
            "market_cap": market_cap,
            "currency": "INR",
            "data_note": "Near real-time data - Yahoo Finance delayed feed",
            "timestamp": datetime.utcnow(),
        }

    def get_ohlc(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> list[CandleRecord]:
        """
        Fetch historical OHLCV candles from Yahoo Finance.

        Args:
            symbol:   Ticker with or without .NS suffix
            period:   yfinance period string (e.g., "1mo", "3mo", "6mo", "1y")
            interval: Candle interval (e.g., "1d", "1wk")

        Returns:
            List of OHLCBar dicts sorted oldest → newest.
            Time is formatted as "YYYY-MM-DD" for TradingView Lightweight Charts.

        Raises:
            ValueError: If symbol is not on the watchlist.
            RuntimeError: If yfinance returns empty data.
        """
        symbol = self.normalize_symbol(symbol)
        self._validate_symbol(symbol)

        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)

        if df.empty:
            raise RuntimeError(
                f"No OHLC data returned for {symbol} "
                f"(period={period}, interval={interval}). "
                "The market may be closed or the symbol may be invalid."
            )

        candles: list[CandleRecord] = []
        for ts, row in df.iterrows():
            candles.append({
                "time": ts.strftime("%Y-%m-%d"),       # TradingView Lightweight Charts format
                "chart_time": int(ts.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        return candles  # Already sorted oldest → newest by yfinance

    def get_benchmark_ohlc(
        self,
        symbol: str = "^NSEI",
        period: str = "1y",
        interval: str = "1d",
    ) -> list[CandleRecord]:
        """Fetch adjusted benchmark history without treating it as a tradable stock."""
        if symbol not in INDEX_META:
            raise ValueError("The requested benchmark index is not supported.")
        df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=True)
        if df.empty:
            raise RuntimeError(f"No benchmark data returned for {symbol}.")
        return [
            {
                "time": ts.strftime("%Y-%m-%d"),
                "chart_time": int(ts.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }
            for ts, row in df.iterrows()
        ]

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    def normalize_symbol(self, symbol: str) -> str:
        """Normalize equities and preserve Yahoo's caret-prefixed index symbols."""
        s = symbol.strip().upper()
        if s in INDEX_META:
            return s
        if not s.endswith(".NS"):
            s = f"{s}.NS"
        return s

    def _validate_symbol(self, symbol: str) -> None:
        """Raise ValueError if the symbol is not in the Xeroww watchlist."""
        if symbol not in SYMBOL_META and symbol not in INDEX_META:
            valid = ", ".join([*SYMBOL_META.keys(), *INDEX_META.keys()])
            raise ValueError(
                f"Symbol '{symbol}' is not in the Xeroww watchlist. "
                f"Valid symbols: {valid}"
            )
