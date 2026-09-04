"""
api/main.py
───────────
Xeroww FastAPI application entry point.

Run with:
  uvicorn main:app --reload --port 8000

Or from the project root:
  uvicorn api.main:app --reload --port 8000
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.core.config import settings
from api.routes import health, stocks, quote, ohlc, patterns

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
    print("━" * 60)
    print(f"  Xeroww API v{settings.APP_VERSION} — Market Terminal")
    print("  Data Provider: Yahoo Finance (near real-time, delayed)")
    print("  Database: Option B — no runtime DB required in V0")
    print("  Docs: http://localhost:8000/docs")
    print("━" * 60)
    yield
    print("Xeroww API shutting down.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Xeroww V0 — Market Terminal API. "
        "Serves near real-time Indian stock market data from Yahoo Finance. "
        "Architecture designed for seamless migration to Kafka + Spark + Snowflake in V1–V3."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware — allow React dev server and any configured origins
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(stocks.router)
app.include_router(quote.router)
app.include_router(ohlc.router)
app.include_router(patterns.router)


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
        "endpoints": [
            "GET /health",
            "GET /stocks",
            "GET /quote/{symbol}",
            "GET /ohlc/{symbol}",
            "GET /patterns/{symbol}",
        ],
    }
