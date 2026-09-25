"""
database/session.py
───────────────────
SQLAlchemy engine and session factory for Xeroww.

SQLite is used by default for local development.
             Set DATABASE_URL in .env to use PostgreSQL in production.

Upgrade Path:
  - Set DATABASE_URL=postgresql+psycopg2://user:pass@host/db in .env
  - Tables are auto-created on application startup via lifespan event
  - For production: use Alembic for managed migrations
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# Import settings here after load_dotenv so environment is ready
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./xeroww.db")

# SQLite needs connect_args for check_same_thread safety with FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args,
)

# Enable SQLite foreign key enforcement on every connection
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy ORM models."""
    pass


def get_db():
    """
    FastAPI dependency that yields a SQLAlchemy database session.
    Works with both SQLite (dev) and PostgreSQL (prod).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables() -> None:
    """
    Create all tables from registered ORM models.
    Called once at application startup.
    Idempotent — safe to call multiple times (CREATE IF NOT EXISTS semantics).
    """
    # Import all models so their metadata is registered with Base before create_all
    from api.models import (  # noqa: F401
        alert,
        intelligence,
        portfolio,
        portfolio_intelligence,
        replay_lab,
        stock,
        user,
        watchlist,
    )
    Base.metadata.create_all(bind=engine)
