"""Canonical Decision Workbench API."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from api.core.dependencies import get_current_user, get_market_data_service
from api.database.session import get_db
from api.models.user import User
from api.schemas.decision import (
    DecisionAmendmentCreate,
    DecisionCreateRequest,
    DecisionDetailResponse,
    DecisionListResponse,
    DecisionPreviewRequest,
    DecisionPreviewResponse,
    DecisionStatusChange,
)
from api.services.decision_service import DecisionService
from api.services.market_data_service import MarketDataService
from api.services.thesis_review_service import ThesisReviewService


router = APIRouter(prefix="/decisions", tags=["Decision Workbench"])


def _service(db: Session, user: User, market_data: MarketDataService) -> DecisionService:
    return DecisionService(db, user.id, market_data)


@router.post("/preview", response_model=DecisionPreviewResponse)
def preview_decision(
    body: DecisionPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return _service(db, current_user, market_data).preview(body)


@router.post("", response_model=DecisionDetailResponse, status_code=status.HTTP_201_CREATED)
def create_decision(
    body: DecisionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _service(db, current_user, market_data)
    return service.detail(service.create(body))


@router.get("", response_model=DecisionListResponse)
def list_decisions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status", pattern="^(OPEN|CLOSED|CANCELLED)$"),
    symbol: str | None = None,
    direction: str | None = Query(None, pattern="^(BULLISH|BEARISH|NEUTRAL)$"),
    intent: str | None = Query(None, pattern="^(ENTER|ADD|HOLD|REDUCE|EXIT|WATCH|AVOID)$"),
    source_context: str | None = Query(None, pattern="^(MANUAL|MARKET|REPLAY|PORTFOLIO)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _service(db, current_user, market_data)
    entries, total = service.list(
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        symbol=symbol,
        direction=direction,
        intent=intent,
        source_context=source_context,
    )
    return {"items": [service.summary(entry) for entry in entries], "total": total, "skip": skip, "limit": limit}


@router.get("/{decision_id}", response_model=DecisionDetailResponse)
def get_decision(
    decision_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _service(db, current_user, market_data)
    return service.detail(service.get_or_404(decision_id))


@router.post("/{decision_id}/amendments", response_model=DecisionDetailResponse)
def add_amendment(
    decision_id: int,
    body: DecisionAmendmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _service(db, current_user, market_data)
    return service.detail(service.add_amendment(decision_id, body))


@router.post("/{decision_id}/status", response_model=DecisionDetailResponse)
def transition_status(
    decision_id: int,
    body: DecisionStatusChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    service = _service(db, current_user, market_data)
    return service.detail(service.transition_status(decision_id, body))


@router.get("/{decision_id}/review")
def review_decision(
    decision_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    entry = _service(db, current_user, market_data).get_or_404(decision_id)
    return ThesisReviewService(market_data).review_entry(entry)
