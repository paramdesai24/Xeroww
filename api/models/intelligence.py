"""
models/intelligence.py
──────────────────────
Chart annotation and decision journal domain models.

ChartAnnotation — user-drawn markup on a chart (levels, notes, zones).
DecisionJournalEntry — structured trade thesis and outcome tracking.

Both models store only user state and text content.
Market context is captured as a snapshot JSON at creation time via context_snapshot.
Live market data is NEVER re-fetched from these tables.
"""

import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SAEnum, JSON, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database.session import Base


class AnnotationType(str, enum.Enum):
    HORIZONTAL_LEVEL = "horizontal_level"
    TREND_LINE = "trend_line"
    NOTE = "note"
    ZONE = "zone"
    FIBONACCI = "fibonacci"


class JournalStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class DecisionDirection(str, enum.Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"


class DecisionIntent(str, enum.Enum):
    ENTER = "ENTER"
    ADD = "ADD"
    HOLD = "HOLD"
    REDUCE = "REDUCE"
    EXIT = "EXIT"
    WATCH = "WATCH"
    AVOID = "AVOID"


class DecisionSource(str, enum.Enum):
    MANUAL = "MANUAL"
    MARKET = "MARKET"
    REPLAY = "REPLAY"
    PORTFOLIO = "PORTFOLIO"


class AmendmentType(str, enum.Enum):
    OBSERVATION = "OBSERVATION"
    THESIS_REVISION = "THESIS_REVISION"
    RISK_REVISION = "RISK_REVISION"
    STATUS_CHANGE = "STATUS_CHANGE"


class ChartAnnotation(Base):
    """User-placed annotation on a chart for a specific symbol and timeframe."""
    __tablename__ = "chart_annotations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False, default="1d")
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    annotation_type: Mapped[AnnotationType] = mapped_column(SAEnum(AnnotationType), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="chart_annotations")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<ChartAnnotation(symbol={self.symbol!r}, type={self.annotation_type}, "
            f"user_id={self.user_id})>"
        )


class DecisionJournalEntry(Base):
    """
    Structured trade decision log entry.

    thesis: Free-text investment rationale (why are you entering/exiting?).
    context_snapshot: JSON snapshot of market context at the time of writing
                      (price, volume, pattern, key levels). Frozen at creation.
    action: 'BUY', 'SELL', 'WATCH', 'EXIT', 'PASS', etc.
    status: OPEN → trade is live; CLOSED → exited; CANCELLED → trade not taken.
    """
    __tablename__ = "decision_journal_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    thesis: Mapped[str] = mapped_column(Text, nullable=False)
    context_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[JournalStatus] = mapped_column(
        SAEnum(JournalStatus), nullable=False, default=JournalStatus.OPEN
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    ticket_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    direction: Mapped[DecisionDirection | None] = mapped_column(SAEnum(DecisionDirection), nullable=True)
    intent: Mapped[DecisionIntent | None] = mapped_column(SAEnum(DecisionIntent), nullable=True)
    holding_period: Mapped[str | None] = mapped_column(String(40), nullable=True)
    setup_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    entry_trigger: Mapped[str | None] = mapped_column(Text, nullable=True)
    entry_zone_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    entry_zone_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    invalidation_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    target_zone_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    target_zone_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    max_risk_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    max_allocation_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    change_mind_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    portfolio_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("portfolios.id", ondelete="SET NULL"), nullable=True, index=True
    )
    replay_session_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("replay_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    replay_event_sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    replay_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_context: Mapped[DecisionSource | None] = mapped_column(SAEnum(DecisionSource), nullable=True)
    source_as_of: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source_period: Mapped[str | None] = mapped_column(String(10), nullable=True)
    snapshot_schema_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    snapshot_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    supporting_evidence_keys: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    conflicting_evidence_keys: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    risk_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    owner: Mapped["User"] = relationship("User", back_populates="journal_entries")  # noqa: F821
    amendments: Mapped[list["DecisionTicketAmendment"]] = relationship(
        "DecisionTicketAmendment",
        back_populates="decision",
        cascade="all, delete-orphan",
        order_by="DecisionTicketAmendment.created_at",
    )

    def __repr__(self) -> str:
        return (
            f"<DecisionJournalEntry(symbol={self.symbol!r}, action={self.action!r}, "
            f"status={self.status})>"
        )


class DecisionTicketAmendment(Base):
    """Append-only observation or lifecycle record for a submitted decision."""

    __tablename__ = "decision_ticket_amendments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    decision_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("decision_journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amendment_type: Mapped[AmendmentType] = mapped_column(SAEnum(AmendmentType), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    decision: Mapped[DecisionJournalEntry] = relationship(
        "DecisionJournalEntry", back_populates="amendments"
    )
