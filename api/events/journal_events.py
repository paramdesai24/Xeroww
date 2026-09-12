"""
api/events/journal_events.py
────────────────────────────
Domain events for the Decision Journal and Thesis Intelligence aggregate.
Tracks the lifecycle of trader theses from creation to post-mortem audit reviews.
"""

from dataclasses import dataclass
from typing import Any
from api.events.base import DomainEvent


@dataclass(frozen=True)
class JournalEntryCreated(DomainEvent):
    """Fired when a trader records a new decision thesis."""

    @classmethod
    def create(
        cls,
        entry_id: int,
        symbol: str,
        user_id: int,
        thesis: str,
        entry_type: str | None = None,
        confidence: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "JournalEntryCreated":
        payload = {
            "entry_id": entry_id,
            "symbol": symbol.upper(),
            "user_id": user_id,
            "thesis": thesis,
            "entry_type": entry_type,
            "confidence": confidence,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="journal.entry_created",
            aggregate_id=f"journal:{entry_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class JournalEntryReviewed(DomainEvent):
    """Fired when an algorithmic or human thesis review evaluates subsequent market outcomes."""

    @classmethod
    def create(
        cls,
        entry_id: int,
        symbol: str,
        user_id: int,
        outcome: str,
        audit_score: float | None = None,
        review_notes: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "JournalEntryReviewed":
        payload = {
            "entry_id": entry_id,
            "symbol": symbol.upper(),
            "user_id": user_id,
            "outcome": outcome,
            "audit_score": audit_score,
            "review_notes": review_notes,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="journal.entry_reviewed",
            aggregate_id=f"journal:{entry_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class JournalEntryUpdated(DomainEvent):
    """Fired when notes or metadata on an existing journal entry are edited."""

    @classmethod
    def create(
        cls,
        entry_id: int,
        user_id: int,
        updated_fields: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> "JournalEntryUpdated":
        payload = {
            "entry_id": entry_id,
            "user_id": user_id,
            "updated_fields": updated_fields,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="journal.entry_updated",
            aggregate_id=f"journal:{entry_id}",
            payload=payload,
            metadata=meta,
        )
