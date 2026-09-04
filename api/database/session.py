"""
database/session.py
───────────────────
SQLAlchemy engine and session factory for Xeroww.

V0 Status: No active database connection is required at runtime.
           Models are defined for schema documentation and V1 readiness.
           The session will only bind to a live DB when DATABASE_URL is set in .env.

V1 Upgrade Path: Set DATABASE_URL in .env and call `Base.metadata.create_all(engine)`
                 at startup to enable persistence.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL: str | None = os.getenv("DATABASE_URL")


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy ORM models."""
    pass


# Engine is only created when DATABASE_URL is set.
# This allows V0 to run purely in-memory / live-fetch mode without any DB dependency.
engine = create_engine(DATABASE_URL, echo=False) if DATABASE_URL else None

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
) if engine else None


def get_db():
    """
    FastAPI dependency that yields a SQLAlchemy database session.
    Only functional when DATABASE_URL is configured (V1+).
    """
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not configured. "
            "Xeroww V0 runs without a database — set DATABASE_URL in .env to enable persistence."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
