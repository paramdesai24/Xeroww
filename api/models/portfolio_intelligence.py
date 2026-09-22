"""Point-in-time portfolio intelligence persistence models."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database.session import Base


class PortfolioSnapshot(Base):
    """Immutable point-in-time valuation of a tenant-owned portfolio."""

    __tablename__ = "portfolio_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "portfolio_id", "valuation_date", "snapshot_sequence", "valuation_version",
            name="uq_portfolio_snapshot_version",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    as_of: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    valuation_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    snapshot_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cash: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    holdings_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    cost_basis: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    realized_pnl_to_date: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    benchmark_symbol: Mapped[str] = mapped_column(String(30), nullable=False, default="^NSEI")
    benchmark_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    open_decision_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    data_quality: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    valuation_version: Mapped[str] = mapped_column(String(40), nullable=False, default="PORTFOLIO-VALUATION-V1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    holdings: Mapped[list["PortfolioSnapshotHolding"]] = relationship(
        "PortfolioSnapshotHolding", back_populates="snapshot", cascade="all, delete-orphan"
    )


class PortfolioSnapshotHolding(Base):
    """Normalized holding row belonging to an immutable portfolio snapshot."""

    __tablename__ = "portfolio_snapshot_holdings"
    __table_args__ = (UniqueConstraint("snapshot_id", "symbol", name="uq_snapshot_holding_symbol"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("portfolio_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    sector: Mapped[str] = mapped_column(String(100), nullable=False, default="Unclassified")
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    average_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    cost_basis: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    market_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    market_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    portfolio_weight: Mapped[Decimal] = mapped_column(Numeric(10, 8), nullable=False)
    data_as_of: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_stale: Mapped[bool] = mapped_column(nullable=False, default=False)

    snapshot: Mapped[PortfolioSnapshot] = relationship("PortfolioSnapshot", back_populates="holdings")


class PortfolioRiskPolicy(Base):
    """Versioned explainable risk thresholds for one portfolio."""

    __tablename__ = "portfolio_risk_policies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    max_single_stock_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=25)
    max_sector_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=40)
    max_planned_loss_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=2)
    max_total_open_risk_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=6)
    correlation_warning: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=0.8)
    drawdown_review_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=10)
    minimum_observations: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=func.now(),
    )

