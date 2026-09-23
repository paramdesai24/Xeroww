"""Persistent domain models for the Replay and Behaviour Lab."""

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database.session import Base


class ReplaySessionStatus(str, enum.Enum):
    SETUP = "SETUP"
    AWAITING_DECISION = "AWAITING_DECISION"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class ReplayCompletionReason(str, enum.Enum):
    INVALIDATION = "INVALIDATION"
    TARGET = "TARGET"
    USER_EXIT = "USER_EXIT"
    PERIOD_END = "PERIOD_END"
    NO_ENTRY = "NO_ENTRY"
    ABANDONED = "ABANDONED"


class ReplayExecutionSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class ReplaySession(Base):
    """Tenant-owned replay aggregate with a server-controlled cursor."""

    __tablename__ = "replay_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[ReplaySessionStatus] = mapped_column(
        SAEnum(ReplaySessionStatus), nullable=False, default=ReplaySessionStatus.SETUP, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    symbol_was_randomized: Mapped[bool] = mapped_column(nullable=False, default=False)
    start_was_randomized: Mapped[bool] = mapped_column(nullable=False, default=False)
    hide_symbol: Mapped[bool] = mapped_column(nullable=False, default=False)
    hide_calendar_date: Mapped[bool] = mapped_column(nullable=False, default=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False, default="1d")
    source_period: Mapped[str] = mapped_column(String(10), nullable=False, default="1y")
    starting_capital: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    current_cash: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    maximum_risk_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    setup_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    start_index: Mapped[int] = mapped_column(Integer, nullable=False)
    current_index: Mapped[int] = mapped_column(Integer, nullable=False)
    end_index: Mapped[int] = mapped_column(Integer, nullable=False)
    warmup_start_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at_market_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    current_market_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at_market_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completion_reason: Mapped[ReplayCompletionReason | None] = mapped_column(
        SAEnum(ReplayCompletionReason), nullable=True
    )
    random_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    dataset_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dataset_payload: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    analytics_version: Mapped[str] = mapped_column(String(40), nullable=False, default="REPLAY-STATE-V1")
    scoring_version: Mapped[str] = mapped_column(String(40), nullable=False, default="process-v1")
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
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    events: Mapped[list["ReplaySessionEvent"]] = relationship(
        "ReplaySessionEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ReplaySessionEvent.sequence_number",
    )
    executions: Mapped[list["ReplayExecution"]] = relationship(
        "ReplayExecution", back_populates="session", cascade="all, delete-orphan"
    )
    result: Mapped["ReplaySessionResult | None"] = relationship(
        "ReplaySessionResult", back_populates="session", cascade="all, delete-orphan", uselist=False
    )


class ReplaySessionEvent(Base):
    """Append-only durable action history for one replay session."""

    __tablename__ = "replay_session_events"
    __table_args__ = (
        UniqueConstraint("session_id", "sequence_number", name="uq_replay_event_sequence"),
        UniqueConstraint("session_id", "idempotency_key", name="uq_replay_event_idempotency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("replay_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    replay_index: Mapped[int] = mapped_column(Integer, nullable=False)
    simulated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )
    decision_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("decision_journal_entries.id", ondelete="SET NULL"), nullable=True, index=True
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    evidence_snapshot_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    session: Mapped[ReplaySession] = relationship("ReplaySession", back_populates="events")


class ReplayExecution(Base):
    """Immutable simulated fill used only for replay outcome measurement."""

    __tablename__ = "replay_executions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("replay_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("decision_journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("replay_session_events.id", ondelete="SET NULL"), nullable=True
    )
    side: Mapped[ReplayExecutionSide] = mapped_column(SAEnum(ReplayExecutionSide), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    replay_index: Mapped[int] = mapped_column(Integer, nullable=False)
    simulated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    session: Mapped[ReplaySession] = relationship("ReplaySession", back_populates="executions")


class ReplaySessionResult(Base):
    """Reproducible process and outcome projection over immutable session facts."""

    __tablename__ = "replay_session_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("replay_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    process_score: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    process_grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    process_components: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    outcome_metrics: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    behaviour_observations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    calculation_inputs_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    scoring_version: Mapped[str] = mapped_column(String(40), nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    session: Mapped[ReplaySession] = relationship("ReplaySession", back_populates="result")
