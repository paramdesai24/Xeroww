"""Append-only replay event sequencing and idempotency."""

from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from api.models.replay_lab import ReplaySession, ReplaySessionEvent


class ReplayEventService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def find_idempotent(self, session_id: int, key: str | None) -> ReplaySessionEvent | None:
        if not key:
            return None
        return (
            self.db.query(ReplaySessionEvent)
            .filter(
                ReplaySessionEvent.session_id == session_id,
                ReplaySessionEvent.user_id == self.user_id,
                ReplaySessionEvent.idempotency_key == key,
            )
            .first()
        )

    def append(
        self,
        session: ReplaySession,
        event_type: str,
        *,
        payload: dict[str, Any] | None = None,
        decision_id: int | None = None,
        idempotency_key: str | None = None,
        evidence_snapshot_hash: str | None = None,
    ) -> ReplaySessionEvent:
        existing = self.find_idempotent(session.id, idempotency_key)
        if existing:
            return existing
        current = (
            self.db.query(func.max(ReplaySessionEvent.sequence_number))
            .filter(ReplaySessionEvent.session_id == session.id)
            .scalar()
        )
        event = ReplaySessionEvent(
            session_id=session.id,
            user_id=self.user_id,
            sequence_number=int(current or 0) + 1,
            event_type=event_type,
            replay_index=session.current_index,
            simulated_at=session.current_market_time,
            decision_id=decision_id,
            idempotency_key=idempotency_key,
            payload=payload or {},
            evidence_snapshot_hash=evidence_snapshot_hash,
            schema_version=1,
        )
        self.db.add(event)
        self.db.flush()
        return event

