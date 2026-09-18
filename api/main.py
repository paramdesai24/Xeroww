"""
api/main.py
───────────
Xeroww FastAPI application entry point — V0.6 Multi-Tenant Financial Intelligence Platform.

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
from api.database.session import create_all_tables

# V0.5 routes (preserved)
from api.routes import health, stocks, quote, ohlc, patterns

# V0.6 routes (new)
from api.routes import auth, watchlists, portfolios, alerts, journal, market_structure, replay, diff, forensics, annotations, intelligence, events, system_health

# V0.8 routes (Fuzzy Explainability Engine)
from api.routes import fuzzy

# ---------------------------------------------------------------------------
# Load environment variables from .env (if present)
# ---------------------------------------------------------------------------
load_dotenv()


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle handler."""
    # Local development convenience only. Production schemas are managed by Alembic.
    if settings.AUTO_CREATE_TABLES:
        create_all_tables()

    # Initialize Domain Event Bus & register default decoupled subscribers
    from api.events import get_event_bus, register_default_handlers
    register_default_handlers(get_event_bus())

    print("=" * 60)
    print(f"  Xeroww API v{settings.APP_VERSION} — Financial Intelligence Platform")
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
    version=settings.APP_VERSION,
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



# ---------------------------------------------------------------------------
# Global Exception Handlers
# ---------------------------------------------------------------------------
from fastapi.responses import JSONResponse
from api.core.exceptions import XerowwException
from api.core.tracing import get_current_trace_id
from datetime import datetime, timezone


@app.exception_handler(XerowwException)
async def xeroww_exception_handler(request, exc: XerowwException):
    headers = {}
    if exc.status_code == 429:
        headers["Retry-After"] = "60"
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={
            "detail": exc.message,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": get_current_trace_id(),
        },
    )



# ---------------------------------------------------------------------------
# Register V0.5 routers (preserved)
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(stocks.router)
app.include_router(quote.router)
app.include_router(ohlc.router)
app.include_router(patterns.router)

# ---------------------------------------------------------------------------
# Register V0.6 routers (multi-tenant platform & market structure engine)
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
# Register V0.8 routers (Fuzzy Explainability Engine)
# ---------------------------------------------------------------------------
app.include_router(fuzzy.router)


# ---------------------------------------------------------------------------
# Root redirect to docs
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "v05_endpoints": [
            "GET /health",
            "GET /stocks",
            "GET /quote/{symbol}",
            "GET /ohlc/{symbol}",
            "GET /patterns/{symbol}",
        ],
        "v06_endpoints": [
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
        ],
        "v08_endpoints": [
            "GET  /fuzzy/explain",
        ],
    }
