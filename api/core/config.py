"""
api/core/config.py
──────────────────
Central configuration for the Xeroww API.

All environment-specific values live here — nothing is hardcoded in routes or services.
Loaded once at startup from environment variables / .env file.
"""

import os
import secrets
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # App metadata
    APP_NAME: str = "Xeroww API"
    APP_VERSION: str = os.getenv("APP_VERSION", "0.6.0")
    APP_ENV: str = os.getenv("APP_ENV", "development")

    # CORS
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000",
        ).split(",")
    ]

    # Database — defaults to SQLite for zero-config local dev; set DATABASE_URL for PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./xeroww.db")

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

    # JWT configuration
    # IMPORTANT: Override JWT_SECRET_KEY in production with a long random secret
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        secrets.token_urlsafe(32),  # Random per-process in dev; set explicitly in prod
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")
    )

    # Default portfolio cash balance for new portfolios
    DEFAULT_PORTFOLIO_CASH: float = float(
        os.getenv("DEFAULT_PORTFOLIO_CASH", "1000000.0")  # ₹10 lakh virtual capital
    )


# Singleton instance — import this everywhere
settings = Settings()
