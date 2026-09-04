"""
api/core/config.py
──────────────────
Central configuration for the Xeroww API.

All environment-specific values live here — nothing is hardcoded in routes or services.
Loaded once at startup from environment variables / .env file.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # App metadata
    APP_NAME: str = "Xeroww API"
    APP_VERSION: str = os.getenv("APP_VERSION", "0.1.0")
    APP_ENV: str = os.getenv("APP_ENV", "development")

    # CORS
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000",
        ).split(",")
    ]

    # Database (V0 — optional)
    DATABASE_URL: str | None = os.getenv("DATABASE_URL", None)

    # Market data provider selection
    # Future values: "kafka", "spark", "snowflake"
    MARKET_DATA_PROVIDER: str = os.getenv("MARKET_DATA_PROVIDER", "yahoo")

    # Yahoo Finance defaults
    OHLC_DEFAULT_PERIOD: str = os.getenv("OHLC_DEFAULT_PERIOD", "1mo")
    OHLC_DEFAULT_INTERVAL: str = os.getenv("OHLC_DEFAULT_INTERVAL", "1d")

    # Pattern detection thresholds (tunable without code changes)
    MARUBOZU_SHADOW_THRESHOLD: float = float(
        os.getenv("MARUBOZU_SHADOW_THRESHOLD", "0.02")
    )
    MARUBOZU_BODY_RANGE_RATIO: float = float(
        os.getenv("MARUBOZU_BODY_RANGE_RATIO", "0.90")
    )

    # Watchlist — can be overridden via env (comma-separated symbols)
    WATCHLIST_SYMBOLS: list[str] = [
        s.strip()
        for s in os.getenv(
            "WATCHLIST_SYMBOLS",
            "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,ICICIBANK.NS",
        ).split(",")
    ]


# Singleton instance — import this everywhere
settings = Settings()
