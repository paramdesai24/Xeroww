"""
models/portfolio.py
───────────────────
Portfolio domain models for Xeroww simulated paper trading.

Holdings store only quantity and average purchase price.
ALL current market values and P&L are calculated at query time via MarketDataProvider.
Market prices are NEVER stored in portfolio tables.

Transaction sides: BUY increases holdings, SELL decreases them.
"""

import enum
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, UniqueConstraint, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database.session import Base


class TradeSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class Portfolio(Base):
    """Simulated virtual portfolio owned by a single user."""
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    cash_balance: Mapped[float] = mapped_column(Float, nullable=False, default=1_000_000.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow,
        onupdate=datetime.utcnow, server_default=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="portfolios")  # noqa: F821
    holdings: Mapped[list["Holding"]] = relationship(
        "Holding", back_populates="portfolio", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["PortfolioTransaction"]] = relationship(
        "PortfolioTransaction", back_populates="portfolio", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Portfolio(id={self.id}, name={self.name!r}, cash={self.cash_balance})>"


class Holding(Base):
    """
    A current position in a simulated portfolio.
    Stores quantity and average purchase price (cost basis).
    Current market value is always computed live from MarketDataProvider.
    """
    __tablename__ = "holdings"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "symbol", name="uq_holding_symbol"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    average_price: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow,
        onupdate=datetime.utcnow, server_default=func.now()
    )

    # Relationship
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="holdings")

    def __repr__(self) -> str:
        return f"<Holding(symbol={self.symbol!r}, qty={self.quantity}, avg={self.average_price})>"


class PortfolioTransaction(Base):
    """
    Immutable audit ledger of all paper trades executed.
    Stores execution price at trade time — NOT updated later.
    """
    __tablename__ = "portfolio_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    side: Mapped[TradeSide] = mapped_column(SAEnum(TradeSide), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    execution_price: Mapped[float] = mapped_column(Float, nullable=False)
    realized_pnl: Mapped[float | None] = mapped_column(Float, nullable=True)  # Only on SELL
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )

    # Relationship
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="transactions")

    def __repr__(self) -> str:
        return (
            f"<PortfolioTransaction({self.side} {self.quantity}x {self.symbol!r} "
            f"@ {self.execution_price})>"
        )
