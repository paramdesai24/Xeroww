"""
api/services/alert_service.py
──────────────────────────────
Service layer for Alert domain operations.
Encapsulates all database interactions, tenant-scoping, and evaluation invocation.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from api.models.alert import Alert, AlertType
from api.schemas.alert import AlertCreate, AlertEvaluationResult
from api.services.alert_evaluator import StandardAlertEvaluator

_evaluator = StandardAlertEvaluator()


class AlertService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def list_alerts(self, skip: int = 0, limit: int = 50) -> list[Alert]:
        return (
            self.db.query(Alert)
            .filter(Alert.user_id == self.user_id)
            .order_by(Alert.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_alert_or_404(self, alert_id: int) -> Alert:
        alert = (
            self.db.query(Alert)
            .filter(Alert.id == alert_id, Alert.user_id == self.user_id)
            .first()
        )
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found.",
            )
        return alert

    def create_alert(self, data: AlertCreate) -> Alert:
        try:
            alert_type = AlertType(data.alert_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid alert_type: '{data.alert_type}'. Valid types: {[t.value for t in AlertType]}",
            )

        alert = Alert(
            user_id=self.user_id,
            symbol=data.symbol.strip().upper(),
            alert_type=alert_type,
            condition_payload=data.condition_payload,
            enabled=True,
        )
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def delete_alert(self, alert_id: int) -> None:
        alert = self.get_alert_or_404(alert_id)
        self.db.delete(alert)
        self.db.commit()

    def evaluate_alert(self, alert_id: int) -> AlertEvaluationResult:
        alert = self.get_alert_or_404(alert_id)
        result = _evaluator.evaluate(alert)
        if result.triggered:
            alert.triggered_at = datetime.utcnow()
            self.db.commit()
        return result

    def evaluate_all_alerts(self) -> list[AlertEvaluationResult]:
        alerts = (
            self.db.query(Alert)
            .filter(Alert.user_id == self.user_id, Alert.enabled == True)  # noqa: E712
            .all()
        )
        results = []
        for alert in alerts:
            result = _evaluator.evaluate(alert)
            if result.triggered:
                alert.triggered_at = datetime.utcnow()
            results.append(result)
        self.db.commit()
        return results
