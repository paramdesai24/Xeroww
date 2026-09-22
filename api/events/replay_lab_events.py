"""Bounded integration events for Replay Lab state changes."""

from dataclasses import dataclass
from typing import Any

from api.events.base import DomainEvent


@dataclass(frozen=True)
class ReplayLabEvent(DomainEvent):
    @classmethod
    def create(cls, action: str, session, payload: dict[str, Any] | None = None) -> "ReplayLabEvent":
        return cls(
            event_type=f"replay.{action}",
            aggregate_id=f"replay-session:{session.id}",
            payload={
                "session_id": session.id,
                "status": getattr(session.status, "value", session.status),
                "replay_index": session.current_index,
                "version": session.version,
                **(payload or {}),
            },
            metadata={"user_id": session.user_id},
        )
