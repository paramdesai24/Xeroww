"""
models/stock.py
───────────────
SQLAlchemy ORM models for Xeroww.

These models define persisted instruments and daily candles.
"""

from datetime import datetime, date
from sqlalchemy import String, Float, Integer, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database.session import Base


class Stock(Base):
    """
    Represents a tracked stock instrument on Xeroww's watchlist.
    Maps to the `stocks` table.
    """
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    exchange: Mapped[str] = mapped_column(String(20), nullable=False, default="NSE")
    sector: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship to historical candle data
    candles: Mapped[list["DailyCandle"]] = relationship("DailyCandle", back_populates="stock")

    def __repr__(self) -> str:
        return f"<Stock(symbol={self.symbol!r}, name={self.display_name!r})>"


class DailyCandle(Base):
    """
    Represents a single OHLCV daily candle for a stock.
    Maps to the `daily_candles` table.
    Source: MarketDataProvider.
    """
    __tablename__ = "daily_candles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[int] = mapped_column(Integer, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Back-reference to parent stock
    stock: Mapped["Stock"] = relationship("Stock", back_populates="candles")

    def __repr__(self) -> str:
        return f"<DailyCandle(stock_id={self.stock_id}, date={self.date}, close={self.close})>"
