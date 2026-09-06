"""
routes/journal.py
──────────────────
Decision journal API endpoints — thin routes delegating to JournalService.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.schemas.intelligence import JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse
from api.services.journal_service import JournalService

router = APIRouter(prefix="/journal", tags=["Decision Journal"])


@router.get("/{entry_id}/review", summary="Thesis review audit against subsequent market observations")
def review_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = JournalService(db, current_user.id)
    return svc.review_entry(entry_id)


@router.get("", response_model=list[JournalEntryResponse], summary="List journal entries")
def list_entries(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = JournalService(db, current_user.id)
    return svc.list_entries(skip=skip, limit=limit)


@router.post(
    "",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a new trading decision thesis",
)
def create_entry(
    body: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = JournalService(db, current_user.id)
    return svc.create_entry(body)


@router.get("/{entry_id}", response_model=JournalEntryResponse, summary="Get single journal entry")
def get_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = JournalService(db, current_user.id)
    return svc.get_entry_or_404(entry_id)


@router.put("/{entry_id}", response_model=JournalEntryResponse, summary="Update post-trade review/outcome")
def update_entry(
    entry_id: int,
    body: JournalEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = JournalService(db, current_user.id)
    return svc.update_entry(entry_id, body)
