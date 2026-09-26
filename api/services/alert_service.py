"""
api/services/alert_service.py
──────────────────────────────
Service layer for Alert domain operations.
Encapsulates all database interactions, tenant-scoping, and evaluation invocation.
"""

from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from pydantic import ValidationError

from api.models.alert import Alert, AlertEvaluation, AlertType
from api.schemas.alert import AlertCreate, AlertPatch, AlertEvaluationResult, AlertEvaluationSummary, AlertResponse
from api.services.alert_evaluator import StandardAlertEvaluator

class AlertService:
    def __init__(self, db: Session, user_id: int, evaluator=None):
        self.db = db
        self.user_id = user_id
        self.evaluator = evaluator or StandardAlertEvaluator()

    def list_alerts(self, skip: int = 0, limit: int = 50) -> list[AlertResponse]:
        alerts = (
            self.db.query(Alert)
            .filter(Alert.user_id == self.user_id)
            .order_by(Alert.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        if not alerts:
            return []
        ids = [alert.id for alert in alerts]
        latest_ids = (
            self.db.query(func.max(AlertEvaluation.id))
            .filter(AlertEvaluation.alert_id.in_(ids))
            .group_by(AlertEvaluation.alert_id)
        )
        latest = {
            row.alert_id: AlertEvaluationSummary.model_validate(row)
            for row in self.db.query(AlertEvaluation).filter(AlertEvaluation.id.in_(latest_ids)).all()
        }
        return [
            AlertResponse.model_validate(alert).model_copy(update={"latest_evaluation": latest.get(alert.id)})
            for alert in alerts
        ]

    def list_evaluations(self, alert_id: int, limit: int = 20) -> list[AlertEvaluation]:
        self.get_alert_or_404(alert_id)
        return (
            self.db.query(AlertEvaluation)
            .filter(AlertEvaluation.alert_id == alert_id)
            .order_by(AlertEvaluation.id.desc())
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

        try:
            from api.events import get_event_bus, AlertCreated
            get_event_bus().publish(
                AlertCreated.create(
                    alert_id=alert.id,
                    symbol=alert.symbol,
                    alert_type=alert.alert_type.value,
                    condition_payload=alert.condition_payload,
                    user_id=self.user_id,
                )
            )
        except Exception:
            pass

        return alert

    def update_alert(self, alert_id: int, data: AlertPatch) -> AlertResponse:
        alert = self.get_alert_or_404(alert_id)
        try:
            validated = AlertCreate.model_validate({
                "symbol": alert.symbol,
                "alert_type": data.alert_type if data.alert_type is not None else alert.alert_type.value,
                "condition_payload": data.condition_payload if data.condition_payload is not None else alert.condition_payload,
            })
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors(include_context=False)) from exc
        alert.alert_type = AlertType(validated.alert_type)
        alert.condition_payload = validated.condition_payload
        if data.enabled is not None:
            alert.enabled = data.enabled
        self.db.commit()
        self.db.refresh(alert)
        latest = self.list_evaluations(alert_id, 1)
        return AlertResponse.model_validate(alert).model_copy(update={
            "latest_evaluation": AlertEvaluationSummary.model_validate(latest[0]) if latest else None
        })

    def delete_alert(self, alert_id: int) -> None:
        alert = self.get_alert_or_404(alert_id)
        self.db.delete(alert)
        self.db.commit()

        try:
            from api.events import get_event_bus, AlertDeleted
            get_event_bus().publish(
                AlertDeleted.create(
                    alert_id=alert_id,
                    user_id=self.user_id,
                )
            )
        except Exception:
            pass

    def evaluate_alert(self, alert_id: int) -> AlertEvaluationResult:
        alert = self.get_alert_or_404(alert_id)
        if not alert.enabled:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resume this alert before evaluating it.")
        result = self._safe_evaluate(alert)
        evaluation = self._record(alert, result)
        self.db.commit()
        result.evaluation_id = evaluation.id
        result.evaluated_at = evaluation.evaluated_at
        self._publish_result(alert, result)
        return result

    def _safe_evaluate(self, alert: Alert) -> AlertEvaluationResult:
        try:
            return self.evaluator.evaluate(alert)
        except Exception:
            return AlertEvaluationResult(
                alert_id=alert.id,
                symbol=alert.symbol,
                alert_type=alert.alert_type.value,
                triggered=False,
                current_value=None,
                condition_payload=alert.condition_payload,
                message="Market data was unavailable for this check.",
                data_quality_status="error",
            )

    def _record(self, alert: Alert, result: AlertEvaluationResult) -> AlertEvaluation:
        now = datetime.utcnow()
        evaluation = AlertEvaluation(
            alert_id=alert.id,
            evaluated_at=now,
            triggered=result.triggered,
            observed_value=result.current_value,
            message=result.message[:240],
            data_quality_status=result.data_quality_status,
        )
        self.db.add(evaluation)
        if result.triggered:
            alert.triggered_at = now
        result.evaluated_at = now
        return evaluation

    def _publish_result(self, alert: Alert, result: AlertEvaluationResult) -> None:
        try:
            from api.events import get_event_bus, AlertEvaluated, AlertTriggered
            bus = get_event_bus()
            bus.publish(
                AlertEvaluated.create(
                    alert_id=alert.id,
                    symbol=alert.symbol,
                    triggered=result.triggered,
                    current_price=result.current_value,
                    user_id=self.user_id,
                )
            )
            if result.triggered:
                bus.publish(
                    AlertTriggered.create(
                        alert_id=alert.id,
                        symbol=alert.symbol,
                        alert_type=alert.alert_type.value,
                        trigger_price=result.current_value,
                        reason=result.message,
                        user_id=self.user_id,
                    )
                )
        except Exception:
            pass

    def evaluate_all_alerts(self) -> list[AlertEvaluationResult]:
        alerts = (
            self.db.query(Alert)
            .filter(Alert.user_id == self.user_id, Alert.enabled == True)  # noqa: E712
            .all()
        )
        results: list[AlertEvaluationResult] = []
        evaluations: list[AlertEvaluation] = []
        for alert in alerts:
            result = self._safe_evaluate(alert)
            evaluations.append(self._record(alert, result))
            results.append(result)
        self.db.commit()
        for alert, result, evaluation in zip(alerts, results, evaluations):
            result.evaluation_id = evaluation.id
            self._publish_result(alert, result)
        return results

