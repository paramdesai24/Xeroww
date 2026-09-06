"""
routes/annotations.py
──────────────────────
Personal market memory and chart annotation endpoints — thin routes delegating to AnnotationService.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.schemas.intelligence import AnnotationCreate, AnnotationResponse
from api.services.annotation_service import AnnotationService

router = APIRouter(prefix="/annotations", tags=["Personal Market Memory"])


@router.get("", response_model=list[AnnotationResponse], summary="List annotations with optional symbol filter")
def list_annotations(
    symbol: str | None = None,
    timeframe: str | None = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AnnotationService(db, current_user.id)
    return svc.list_annotations(symbol=symbol, timeframe=timeframe, skip=skip, limit=limit)


@router.get("/timeline/{symbol}", response_model=list[AnnotationResponse], summary="Chronological observation timeline for symbol")
def symbol_timeline(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AnnotationService(db, current_user.id)
    return svc.get_symbol_timeline(symbol)


@router.post(
    "",
    response_model=AnnotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a chart annotation or market observation",
)
def create_annotation(
    body: AnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AnnotationService(db, current_user.id)
    return svc.create_annotation(body)


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an annotation")
def delete_annotation(
    annotation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AnnotationService(db, current_user.id)
    svc.delete_annotation(annotation_id)
