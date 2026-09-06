"""
models/alert.py
───────────────
Alert domain model for Xeroww multi-tenant alert engine.

Alert types supported in V0.6:
  price_above       — triggered when current price exceeds threshold
  price_below       — triggered when current price drops below threshold
  percentage_move   — triggered on N% move from reference price
  volume_spike      — triggered when volume exceeds N× the average
  pattern_detected  — triggered when a Marubozu pattern is detected
  moving_average_cross — triggered on MA crossover (simple/exponential)

condition_payload stores the alert-type-specific parameters as JSON.
For example: {"threshold": 2500.0} or {"pct": 5.0, "direction": "up"}

Alert evaluation is STATELESS — the AlertEvaluator reads condition_payload
and queries MarketDataProvider at evaluation time. No market data is stored here.
"""

import enum
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database.session import Base


class AlertType(str, enum.Enum):
    PRICE_ABOVE = "price_above"
    PRICE_BELOW = "price_below"
    PERCENTAGE_MOVE = "percentage_move"
    VOLUME_SPIKE = "volume_spike"
    PATTERN_DETECTED = "pattern_detected"
    MOVING_AVERAGE_CROSS = "moving_average_cross"


class Alert(Base):
    """An alert condition registered by a user for a specific symbol."""
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    alert_type: Mapped[AlertType] = mapped_column(SAEnum(AlertType), nullable=False)
    condition_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    # Relationship
    owner: Mapped["User"] = relationship("User", back_populates="alerts")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<Alert(id={self.id}, symbol={self.symbol!r}, "
            f"type={self.alert_type}, enabled={self.enabled})>"
        )
