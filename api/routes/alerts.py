"""
routes/alerts.py
─────────────────
Alert API endpoints — tenant-scoped, no polling loops in FastAPI.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.database.session import get_db
from api.core.dependencies import get_current_user
from api.models.user import User
from api.models.alert import Alert, AlertType
from api.services.alert_evaluator import StandardAlertEvaluator
from api.schemas.alert import AlertCreate, AlertResponse, AlertEvaluationResult

router = APIRouter(prefix="/alerts", tags=["Alerts"])
_evaluator = StandardAlertEvaluator()


def _validate_alert_type(alert_type: str) -> AlertType:
    try:
        return AlertType(alert_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid alert_type: '{alert_type}'. Valid types: {[t.value for t in AlertType]}",
        )


@router.get("", response_model=list[AlertResponse], summary="List current user alerts")
def list_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Alert)
        .filter(Alert.user_id == current_user.id)
        .order_by(Alert.created_at.desc())
        .all()
    )


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
    alert_type = _validate_alert_type(body.alert_type)
    alert = Alert(
        user_id=current_user.id,
        symbol=body.symbol.strip().upper(),
        alert_type=alert_type,
        condition_payload=body.condition_payload,
        enabled=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an alert")
def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found.")
    db.delete(alert)
    db.commit()


@router.post("/{alert_id}/evaluate", response_model=AlertEvaluationResult, summary="Evaluate one alert")
def evaluate_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found.")
    result = _evaluator.evaluate(alert)
    if result.triggered:
        alert.triggered_at = datetime.utcnow()
        db.commit()
    return result


@router.post("/evaluate-all", response_model=list[AlertEvaluationResult], summary="Evaluate all enabled alerts")
def evaluate_all_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alerts = (
        db.query(Alert)
        .filter(Alert.user_id == current_user.id, Alert.enabled == True)  # noqa: E712
        .all()
    )
    results = []
    for alert in alerts:
        result = _evaluator.evaluate(alert)
        if result.triggered:
            alert.triggered_at = datetime.utcnow()
        results.append(result)
    db.commit()
    return results
