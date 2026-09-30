"""
tests/conftest.py
──────────────────
Pytest fixtures shared across all Xeroww test modules.

Uses an in-memory SQLite database per test session for complete isolation.
No real network calls are made — market data is mocked.
"""

import sys
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

# Ensure project root on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from api.database.session import Base, get_db
from api.main import app
from api.core.config import settings
from api.services.cache_service import get_cache_service
from api.services.market_provider import MarketDataProviderMetadata

# Increase rate limits for test suite so sequential runs do not trigger 429
settings.RATE_LIMIT_UNAUTH_RPM = 100000
settings.RATE_LIMIT_AUTH_RPM = 100000

# In-memory SQLite for tests — isolated per session
TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture(autouse=True)
def reset_cache_state():
    """Ensure clean cache and rate limit counters between every test function."""
    cache = get_cache_service()
    cache.flush()
    yield
    cache.flush()



@pytest.fixture(scope="session")
def engine():
    """Create a fresh in-memory SQLite engine for the test session."""
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    # Import all models so metadata is registered
    from api.models import user, watchlist, portfolio, alert, intelligence, stock  # noqa
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db(engine) -> Session:
    """Provide a fresh transactional DB session, rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db: Session) -> TestClient:
    """TestClient with overridden DB dependency for full integration tests."""
    from api.core.dependencies import get_market_data_service
    from api.services.cache_service import InMemoryCacheService
    from api.services.market_data_service import MarketDataService

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_market_data_service] = lambda: MarketDataService(
        mock_provider, InMemoryCacheService()
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Mock market provider — avoids real Yahoo Finance calls during tests
# ---------------------------------------------------------------------------

class MockMarketProvider:
    """Returns deterministic fake market data for unit tests."""

    INDEX_NAMES = {
        "^NSEI": "NIFTY 50",
        "^BSESN": "SENSEX",
        "^NSEBANK": "NIFTY BANK",
        "^INDIAVIX": "INDIA VIX",
    }
    MOCK_PRICES = {
        "RELIANCE.NS": 2500.0,
        "TCS.NS": 3800.0,
        "INFY.NS": 1600.0,
        "HDFCBANK.NS": 1700.0,
        "ICICIBANK.NS": 1200.0,
    }

    @property
    def metadata(self):
        return MarketDataProviderMetadata(provider_id="test", display_name="Test Provider")

    def get_stocks(self):
        return [
            {"symbol": s, "display_name": s, "exchange": "NSE", "sector": "Test"}
            for s in self.MOCK_PRICES
        ]

    def get_instrument(self, symbol: str):
        normalized = self.normalize_symbol(symbol)
        return {
            "symbol": normalized,
            "display_name": self.INDEX_NAMES.get(normalized, normalized),
            "exchange": "NSE",
            "sector": "Test",
        }

    def get_quote(self, symbol: str):
        symbol = symbol.upper()
        if not symbol.startswith("^") and not symbol.endswith(".NS"):
            symbol += ".NS"
        price = self.MOCK_PRICES.get(symbol, 1000.0)
        return {
            "symbol": symbol,
            "display_name": symbol,
            "price": price,
            "previous_close": price * 0.98,
            "change": price * 0.02,
            "change_pct": 2.0,
            "day_high": price * 1.01,
            "day_low": price * 0.99,
            "volume": 1_000_000,
            "market_cap": price * 1e9,
            "currency": "INR",
            "data_note": "Mock data",
            "timestamp": "2026-01-01T00:00:00",
        }

    def get_ohlc(self, symbol: str, period: str = "1mo", interval: str = "1d"):
        price = self.MOCK_PRICES.get(symbol.upper(), 1000.0)
        return [
            {
                "time": f"2026-01-{i+1:02d}",
                "open": price - 10,
                "high": price + 20,
                "low": price - 20,
                "close": price + (i * 2),
                "volume": 500_000 + i * 10_000,
            }
            for i in range(20)
        ]

    def normalize_symbol(self, symbol: str) -> str:
        s = symbol.strip().upper()
        if s.startswith("^"):
            return s
        return s if s.endswith(".NS") else f"{s}.NS"


mock_provider = MockMarketProvider()
