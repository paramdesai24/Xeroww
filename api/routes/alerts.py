"""
routes/alerts.py
─────────────────
Alert API endpoints — tenant-scoped, thin routes delegating to AlertService.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.schemas.alert import AlertCreate, AlertPatch, AlertResponse, AlertEvaluationResult, AlertEvaluationSummary
from api.services.alert_service import AlertService
from api.services.alert_evaluator import StandardAlertEvaluator
from api.services.market_data_service import MarketDataService
from api.core.dependencies import get_market_data_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertResponse], summary="List current user alerts")
def list_alerts(
    skip: int = 0,
    limit: int = Query(default=500, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AlertService(db, current_user.id)
    return svc.list_alerts(skip=skip, limit=limit)


@router.post(
    "",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new alert",
)
def create_alert(
    body: AlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AlertService(db, current_user.id)
    return svc.create_alert(body)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an alert")
def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AlertService(db, current_user.id)
    svc.delete_alert(alert_id)


@router.patch("/{alert_id}", response_model=AlertResponse, summary="Edit or pause an alert")
def update_alert(
    alert_id: int,
    body: AlertPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AlertService(db, current_user.id).update_alert(alert_id, body)


@router.get("/{alert_id}/evaluations", response_model=list[AlertEvaluationSummary], summary="Recent alert checks")
def list_alert_evaluations(
    alert_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AlertService(db, current_user.id).list_evaluations(alert_id, limit)


@router.post("/{alert_id}/evaluate", response_model=AlertEvaluationResult, summary="Evaluate one alert")
def evaluate_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = AlertService(db, current_user.id, StandardAlertEvaluator(market_data))
    return svc.evaluate_alert(alert_id)


@router.post("/evaluate-all", response_model=list[AlertEvaluationResult], summary="Evaluate all enabled alerts")
def evaluate_all_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    market_data: MarketDataService = Depends(get_market_data_service),
):
    svc = AlertService(db, current_user.id, StandardAlertEvaluator(market_data))
    return svc.evaluate_all_alerts()
