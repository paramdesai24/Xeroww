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
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SAEnum, JSON, func
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

    owner: Mapped["User"] = relationship("User", back_populates="journal_entries")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<DecisionJournalEntry(symbol={self.symbol!r}, action={self.action!r}, "
            f"status={self.status})>"
        )
