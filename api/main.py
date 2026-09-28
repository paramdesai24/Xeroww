"""
api/main.py
───────────
Xeroww FastAPI application entry point.

Run with:
  uvicorn main:app --reload --port 8000

Or from the project root:
  uvicorn api.main:app --reload --port 8000
"""

import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.core.config import settings
from api.core.error_handlers import register_exception_handlers
from api.database.session import create_all_tables

# Market data routes
from api.routes import health, stocks, quote, ohlc, patterns

# Authenticated platform routes
from api.routes import auth, watchlists, portfolios, alerts, journal, market_structure, replay, diff, forensics, annotations, intelligence, events, system_health

# Decision, replay, and intelligence routes
from api.routes import fuzzy
from api.routes import decisions
from api.routes import replay_sessions
from api.routes import portfolio_intelligence

# ---------------------------------------------------------------------------
# Load environment variables from .env (if present)
# ---------------------------------------------------------------------------
load_dotenv()


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle handler."""
    # Opt-in convenience for disposable databases. Alembic owns normal schemas.
    if settings.AUTO_CREATE_TABLES:
        create_all_tables()

    # Initialize Domain Event Bus & register default decoupled subscribers
    from api.events import get_event_bus, register_default_handlers
    register_default_handlers(get_event_bus())

    print("=" * 60)
    print("  Xeroww API - Financial Intelligence Platform")
    print("  Data Provider: Yahoo Finance (near real-time, delayed)")
    print(f"  Database: {settings.DATABASE_URL.split('//')[0]}//...")
    print("  Docs: http://localhost:8000/docs")
    print("=" * 60)
    yield
    print("Xeroww API shutting down.")



# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version="internal",
    description=(
        "Xeroww Financial Intelligence Platform API. "
        "High-performance institutional market data, pattern scanning, "
        "and deterministic market structure analysis."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

from api.core.tracing import TracingMiddleware
from api.core.rate_limit import RateLimitMiddleware
from api.core.metrics import PrometheusMetricsMiddleware, metrics_endpoint

app.add_middleware(PrometheusMetricsMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(TracingMiddleware)

# CORS Middleware added on outer layer to handle all preflight and error responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics endpoint
app.add_api_route("/metrics", metrics_endpoint, methods=["GET"], include_in_schema=False)



register_exception_handlers(app)



# ---------------------------------------------------------------------------
# Register market data routes
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(stocks.router)
app.include_router(quote.router)
app.include_router(ohlc.router)
app.include_router(patterns.router)

# ---------------------------------------------------------------------------
# Register authenticated platform routes
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(watchlists.router)
app.include_router(portfolios.router)
app.include_router(alerts.router)
app.include_router(journal.router)
app.include_router(market_structure.router)
app.include_router(replay.router)
app.include_router(diff.router)
app.include_router(forensics.router)
app.include_router(annotations.router)
app.include_router(intelligence.router)
app.include_router(events.router)
app.include_router(system_health.router)

# ---------------------------------------------------------------------------
# Register decision and intelligence routes
# ---------------------------------------------------------------------------
app.include_router(fuzzy.router)
app.include_router(decisions.router)
app.include_router(replay_sessions.router)
app.include_router(portfolio_intelligence.router)


# ---------------------------------------------------------------------------
# Root redirect to docs
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.APP_NAME,
        "docs": "/docs",
        "health": "/health",
        "endpoints": [
            "GET /health",
            "GET /stocks",
            "GET /quote/{symbol}",
            "GET /ohlc/{symbol}",
            "GET /patterns/{symbol}",
            "POST /auth/register",
            "POST /auth/login",
            "POST /auth/refresh",
            "GET  /auth/me",
            "GET  /watchlists",
            "POST /watchlists",
            "GET  /portfolios",
            "POST /portfolios",
            "POST /portfolios/{id}/trade",
            "GET  /alerts",
            "POST /alerts",
            "POST /alerts/evaluate-all",
            "GET  /journal",
            "POST /journal",
            "GET  /fuzzy/explain",
            "POST /decisions/preview",
            "POST /decisions",
            "GET  /decisions",
            "GET  /decisions/{id}",
        ],
    }
