"""
routes/alerts.py
─────────────────
Alert API endpoints — tenant-scoped, thin routes delegating to AlertService.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.schemas.alert import AlertCreate, AlertResponse, AlertEvaluationResult
from api.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertResponse], summary="List current user alerts")
def list_alerts(
    skip: int = 0,
    limit: int = 50,
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


@router.post("/{alert_id}/evaluate", response_model=AlertEvaluationResult, summary="Evaluate one alert")
def evaluate_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AlertService(db, current_user.id)
    return svc.evaluate_alert(alert_id)


@router.post("/evaluate-all", response_model=list[AlertEvaluationResult], summary="Evaluate all enabled alerts")
def evaluate_all_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = AlertService(db, current_user.id)
    return svc.evaluate_all_alerts()
