"""
models/user.py
──────────────
User domain model for Xeroww multi-tenant platform.

Roles:
  USER  — standard authenticated user (watchlists, portfolios, alerts, journal)
  ADMIN — platform administrator (future: user management, system analytics)

V0.6: Backed by SQLite by default; PostgreSQL-compatible ORM definition.
"""

import enum
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database.session import Base


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class User(Base):
    """
    Represents an authenticated Xeroww platform user.
    All user-owned resources (watchlists, portfolios, alerts, journal) are
    scoped to this entity. Market data is NEVER stored here.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow,
        onupdate=datetime.utcnow, server_default=func.now()
    )

    # Relationships
    watchlists: Mapped[list["Watchlist"]] = relationship(  # noqa: F821
        "Watchlist", back_populates="owner", cascade="all, delete-orphan"
    )
    portfolios: Mapped[list["Portfolio"]] = relationship(  # noqa: F821
        "Portfolio", back_populates="owner", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        "Alert", back_populates="owner", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list["DecisionJournalEntry"]] = relationship(  # noqa: F821
        "DecisionJournalEntry", back_populates="owner", cascade="all, delete-orphan"
    )
    chart_annotations: Mapped[list["ChartAnnotation"]] = relationship(  # noqa: F821
        "ChartAnnotation", back_populates="owner", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email!r}, role={self.role})>"
