"""
routes/journal.py
──────────────────
Decision journal API endpoints — tenant-scoped trade thesis logging.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.models.intelligence import DecisionJournalEntry, JournalStatus
from api.schemas.intelligence import JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse
from api.services.thesis_review_service import ThesisReviewService

router = APIRouter(prefix="/journal", tags=["Decision Journal"])
_thesis_reviewer = ThesisReviewService()


@router.get("/{entry_id}/review", summary="Thesis review audit against subsequent market observations")
def review_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DecisionJournalEntry)
        .filter(
            DecisionJournalEntry.id == entry_id,
            DecisionJournalEntry.user_id == current_user.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry {entry_id} not found.",
        )
    return _thesis_reviewer.review_entry(entry)


@router.get("", response_model=list[JournalEntryResponse], summary="List journal entries")
def list_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(DecisionJournalEntry)
        .filter(DecisionJournalEntry.user_id == current_user.id)
        .order_by(DecisionJournalEntry.timestamp.desc())
        .all()
    )


@router.post(
    "",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a journal entry",
)
def create_entry(
    body: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = DecisionJournalEntry(
        user_id=current_user.id,
        symbol=body.symbol.strip().upper(),
        action=body.action.upper(),
        thesis=body.thesis,
        context_snapshot=body.context_snapshot,
        timestamp=datetime.utcnow(),
        status=JournalStatus.OPEN,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryResponse, summary="Update journal entry status")
def update_entry(
    entry_id: int,
    body: JournalEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(DecisionJournalEntry)
        .filter(
            DecisionJournalEntry.id == entry_id,
            DecisionJournalEntry.user_id == current_user.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry {entry_id} not found.",
        )
    entry.status = JournalStatus(body.status)
    if body.thesis is not None:
        entry.thesis = body.thesis
    db.commit()
    db.refresh(entry)
    return entry
