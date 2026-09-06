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
from api.routes import auth, watchlists, portfolios, alerts, journal, market_structure, replay, diff, forensics

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
    # Auto-create all SQLAlchemy tables (idempotent)
    create_all_tables()

    print("=" * 60)
    print(f"  Xeroww API v{settings.APP_VERSION} — Financial Intelligence Platform")
    print(f"  Data Provider: Yahoo Finance (near real-time, delayed)")
    print(f"  Database: {settings.DATABASE_URL.split('//')[0]}//...")
    print(f"  Docs: http://localhost:8000/docs")
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

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    }
