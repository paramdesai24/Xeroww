"""
routes/annotations.py
─────────────────────
Personal Market Memory & Chart Annotation endpoints.

Allows users to:
- Annotate charts (notes, levels, zones)
- View personal timeline and observation history for a stock
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.models.intelligence import ChartAnnotation, AnnotationType, DecisionJournalEntry
from api.schemas.intelligence import AnnotationCreate, AnnotationResponse, SymbolMemorySummary

router = APIRouter(prefix="/annotations", tags=["Personal Market Memory"])


@router.get("", response_model=list[AnnotationResponse], summary="List user chart annotations")
def list_annotations(
    symbol: str | None = Query(None, description="Optional symbol filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(ChartAnnotation).filter(ChartAnnotation.user_id == current_user.id)
    if symbol:
        q = q.filter(ChartAnnotation.symbol == symbol.strip().upper())
    return q.order_by(ChartAnnotation.timestamp.desc()).all()


@router.post("", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED, summary="Create chart annotation")
def create_annotation(
    body: AnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        atype = AnnotationType(body.annotation_type.lower())
    except ValueError:
        atype = AnnotationType.NOTE

    annotation = ChartAnnotation(
        user_id=current_user.id,
        symbol=body.symbol.strip().upper(),
        timeframe=body.timeframe,
        timestamp=body.timestamp,
        annotation_type=atype,
        content=body.content.strip(),
        metadata_json=body.metadata_json,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return annotation


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete chart annotation")
def delete_annotation(
    annotation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ann = (
        db.query(ChartAnnotation)
        .filter(ChartAnnotation.id == annotation_id, ChartAnnotation.user_id == current_user.id)
        .first()
    )
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found.")
    db.delete(ann)
    db.commit()
    return None


@router.get("/memory/{symbol}", response_model=SymbolMemorySummary, summary="Get personal market memory for symbol")
def get_symbol_memory(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sym = symbol.strip().upper()
    annotations = (
        db.query(ChartAnnotation)
        .filter(ChartAnnotation.user_id == current_user.id, ChartAnnotation.symbol == sym)
        .all()
    )
    journals = (
        db.query(DecisionJournalEntry)
        .filter(DecisionJournalEntry.user_id == current_user.id, DecisionJournalEntry.symbol == sym)
        .all()
    )

    observations = [a.content for a in annotations if a.content]
    last_date = None
    if annotations:
        last_date = max(a.timestamp for a in annotations).strftime("%Y-%m-%d")

    return {
        "symbol": sym,
        "total_annotations": len(annotations),
        "total_journal_entries": len(journals),
        "saved_observations": observations,
        "last_observation_date": last_date,
    }
