"""
api/services/annotation_service.py
───────────────────────────────────
Service layer for Chart Annotations and Personal Market Memory.
Encapsulates all database interactions and tenant-scoping.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from api.models.intelligence import ChartAnnotation, AnnotationType
from api.schemas.intelligence import AnnotationCreate


class AnnotationService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def list_annotations(
        self,
        symbol: str | None = None,
        timeframe: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ChartAnnotation]:
        query = self.db.query(ChartAnnotation).filter(ChartAnnotation.user_id == self.user_id)
        if symbol:
            query = query.filter(ChartAnnotation.symbol == symbol.strip().upper())
        if timeframe:
            query = query.filter(ChartAnnotation.timeframe == timeframe)
        return query.order_by(ChartAnnotation.timestamp.desc()).offset(skip).limit(limit).all()

    def get_symbol_timeline(self, symbol: str) -> list[ChartAnnotation]:
        return (
            self.db.query(ChartAnnotation)
            .filter(
                ChartAnnotation.user_id == self.user_id,
                ChartAnnotation.symbol == symbol.strip().upper(),
            )
            .order_by(ChartAnnotation.timestamp.asc())
            .all()
        )

    def get_annotation_or_404(self, annotation_id: int) -> ChartAnnotation:
        annotation = (
            self.db.query(ChartAnnotation)
            .filter(
                ChartAnnotation.id == annotation_id,
                ChartAnnotation.user_id == self.user_id,
            )
            .first()
        )
        if not annotation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Annotation {annotation_id} not found.",
            )
        return annotation

    def create_annotation(self, data: AnnotationCreate) -> ChartAnnotation:
        try:
            atype = AnnotationType(data.annotation_type)
        except ValueError:
            atype = AnnotationType.NOTE

        annotation = ChartAnnotation(
            user_id=self.user_id,
            symbol=data.symbol.strip().upper(),
            timeframe=data.timeframe or "1d",
            timestamp=data.timestamp,
            annotation_type=atype,
            content=data.content,
            metadata_json=data.metadata_json or {},
        )
        self.db.add(annotation)
        self.db.commit()
        self.db.refresh(annotation)
        return annotation

    def delete_annotation(self, annotation_id: int) -> None:
        annotation = self.get_annotation_or_404(annotation_id)
        self.db.delete(annotation)
        self.db.commit()
