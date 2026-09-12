"""
api/services/journal_service.py
────────────────────────────────
Service layer for Decision Journal operations.
Encapsulates all database interactions, tenant-scoping, and thesis review.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from api.models.intelligence import DecisionJournalEntry, JournalStatus
from api.schemas.intelligence import JournalEntryCreate, JournalEntryUpdate
from api.services.thesis_review_service import ThesisReviewService

_thesis_reviewer = ThesisReviewService()


class JournalService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def list_entries(self, skip: int = 0, limit: int = 50) -> list[DecisionJournalEntry]:
        return (
            self.db.query(DecisionJournalEntry)
            .filter(DecisionJournalEntry.user_id == self.user_id)
            .order_by(DecisionJournalEntry.timestamp.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_entry_or_404(self, entry_id: int) -> DecisionJournalEntry:
        entry = (
            self.db.query(DecisionJournalEntry)
            .filter(
                DecisionJournalEntry.id == entry_id,
                DecisionJournalEntry.user_id == self.user_id,
            )
            .first()
        )
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Journal entry {entry_id} not found.",
            )
        return entry

    def create_entry(self, data: JournalEntryCreate) -> DecisionJournalEntry:
        entry = DecisionJournalEntry(
            user_id=self.user_id,
            symbol=data.symbol.strip().upper(),
            action=data.action.upper(),
            thesis=data.thesis,
            context_snapshot=data.context_snapshot or {},
            status=JournalStatus.OPEN,
            timestamp=datetime.utcnow(),
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)

        try:
            from api.events import get_event_bus, JournalEntryCreated
            get_event_bus().publish(
                JournalEntryCreated.create(
                    entry_id=entry.id,
                    symbol=entry.symbol,
                    user_id=self.user_id,
                    thesis=entry.thesis,
                    entry_type=entry.action,
                )
            )
        except Exception:
            pass

        return entry

    def update_entry(self, entry_id: int, data: JournalEntryUpdate) -> DecisionJournalEntry:
        entry = self.get_entry_or_404(entry_id)

        if data.status is not None:
            try:
                entry.status = JournalStatus(data.status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid status: '{data.status}'. Valid: {[s.value for s in JournalStatus]}",
                )
        if data.thesis is not None:
            entry.thesis = data.thesis

        self.db.commit()
        self.db.refresh(entry)

        try:
            from api.events import get_event_bus, JournalEntryUpdated
            updated = []
            if data.status is not None:
                updated.append("status")
            if data.thesis is not None:
                updated.append("thesis")
            get_event_bus().publish(
                JournalEntryUpdated.create(
                    entry_id=entry.id,
                    user_id=self.user_id,
                    updated_fields=updated,
                )
            )
        except Exception:
            pass

        return entry

    def review_entry(self, entry_id: int) -> dict:
        entry = self.get_entry_or_404(entry_id)
        result = _thesis_reviewer.review_entry(entry)

        try:
            from api.events import get_event_bus, JournalEntryReviewed
            get_event_bus().publish(
                JournalEntryReviewed.create(
                    entry_id=entry.id,
                    symbol=entry.symbol,
                    user_id=self.user_id,
                    outcome=result.get("outcome", "REVIEWED"),
                    audit_score=result.get("score") or result.get("accuracy_score"),
                    review_notes=result.get("summary") or result.get("notes"),
                )
            )
        except Exception:
            pass

        return result

