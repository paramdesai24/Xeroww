"""
api/events/base.py
──────────────────
Core DomainEvent base model.
All domain events across the platform inherit from this base class.
Prepared for streaming serialization to Apache Kafka, Apache Spark, or Redis Streams.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import uuid


@dataclass(frozen=True)
class DomainEvent:
    """
    Immutable base representation of an event that has occurred within the domain.

    Attributes:
        event_id: Unique UUID identifier for deduplication and idempotency.
        event_type: Dot-notated event namespace (e.g. 'portfolio.asset_bought').
        occurred_at: UTC timestamp when the state transition occurred.
        aggregate_id: Qualified aggregate identifier (e.g. 'portfolio:42', 'symbol:RELIANCE').
        version: Schema version of the event payload (for backward-compatible evolutions).
        payload: Event-specific payload dictionary.
        metadata: Contextual data such as user_id, trace_id, correlation_id, source service.
    """
    event_type: str
    aggregate_id: str
    payload: dict[str, Any]
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize event into standard dictionary representation for JSON/Kafka encoding."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "occurred_at": self.occurred_at.isoformat(),
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "payload": self.payload,
            "metadata": self.metadata,
        }
