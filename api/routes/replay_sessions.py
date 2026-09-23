"""Authenticated API for persisted Replay and Behaviour Lab sessions."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from api.core.dependencies import get_current_user, get_market_data_service
from api.database.session import get_db
from api.models.user import User
from api.schemas.decision import DecisionCreateRequest, DecisionPreviewRequest, DecisionPreviewResponse
from api.schemas.replay_lab import (
    ReplayAnalyticsResponse,
    ReplayCommand,
    ReplayEventResponse,
    ReplayExitCreate,
    ReplayReflectionCreate,
    ReplayReviewResponse,
    ReplaySessionCreate,
    ReplaySessionList,
    ReplaySessionState,
)
from api.services.market_data_service import MarketDataService
from api.services.replay_analytics_service import ReplayAnalyticsService
from api.services.replay_session_service import ReplaySessionService


router = APIRouter(tags=["Replay and Behaviour Lab"])


def service(db: Session, user: User, market_data: MarketDataService) -> ReplaySessionService:
    return ReplaySessionService(db, user.id, market_data)


@router.post(
    "/replay-sessions",
    response_model=ReplaySessionState,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    body: ReplaySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.create(body))


@router.get("/replay-sessions", response_model=ReplaySessionList)
def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    items, total = svc.list(skip, limit)
    return {"items": [svc.summary(item) for item in items], "total": total, "skip": skip, "limit": limit}


@router.get("/replay-sessions/{session_id}", response_model=ReplaySessionState)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.get(session_id))


@router.post("/replay-sessions/{session_id}/start", response_model=ReplaySessionState)
def start_session(
    session_id: int,
    body: ReplayCommand,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.start(session_id, body.expected_version, body.idempotency_key))


@router.post(
    "/replay-sessions/{session_id}/decisions/preview",
    response_model=DecisionPreviewResponse,
)
def preview_decision(
    session_id: int,
    body: DecisionPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return service(db, current_user, market_data).preview_decision(session_id, body)


@router.post(
    "/replay-sessions/{session_id}/decisions",
    status_code=status.HTTP_201_CREATED,
)
def submit_decision(
    session_id: int,
    body: DecisionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    decision = svc.submit_decision(session_id, body)
    session = svc.get(session_id)
    return {"decision_id": decision.id, "session_id": session_id, "session_version": session.version}


@router.post("/replay-sessions/{session_id}/advance", response_model=ReplaySessionState)
def advance_session(
    session_id: int,
    body: ReplayCommand,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.advance(session_id, body.expected_version, body.idempotency_key))


@router.post("/replay-sessions/{session_id}/pause", response_model=ReplaySessionState)
def pause_session(
    session_id: int,
    body: ReplayCommand,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.pause(session_id, body.expected_version, body.idempotency_key))


@router.post("/replay-sessions/{session_id}/resume", response_model=ReplaySessionState)
def resume_session(
    session_id: int,
    body: ReplayCommand,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.resume(session_id, body.expected_version, body.idempotency_key))


@router.post("/replay-sessions/{session_id}/exit", response_model=ReplaySessionState)
def exit_session_position(
    session_id: int,
    body: ReplayExitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.exit(session_id, body))


@router.post("/replay-sessions/{session_id}/reflections", response_model=ReplaySessionState)
def record_reflection(
    session_id: int,
    body: ReplayReflectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.reflect(session_id, body))


@router.post("/replay-sessions/{session_id}/abandon", response_model=ReplaySessionState)
def abandon_session(
    session_id: int,
    body: ReplayCommand,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = service(db, current_user, market_data)
    return svc.state(svc.abandon(session_id, body.expected_version, body.idempotency_key))


@router.get("/replay-sessions/{session_id}/events", response_model=list[ReplayEventResponse])
def list_events(
    session_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    session = service(db, current_user, market_data).get(session_id)
    return session.events[skip : skip + limit]


@router.get("/replay-sessions/{session_id}/review", response_model=ReplayReviewResponse)
def review_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    return service(db, current_user, market_data).review(session_id)


@router.get("/replay-analytics", response_model=ReplayAnalyticsResponse)
def replay_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ReplayAnalyticsService(db, current_user.id).build()
