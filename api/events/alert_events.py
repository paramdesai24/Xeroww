"""
api/events/alert_events.py
──────────────────────────
Domain events for the Notification and Alerting aggregate.
Tracks creation, evaluation cycles, and trigger firings for price and pattern alerts.
"""

from dataclasses import dataclass
from typing import Any
from api.events.base import DomainEvent


@dataclass(frozen=True)
class AlertCreated(DomainEvent):
    """Fired when a user registers a new threshold or technical alert."""

    @classmethod
    def create(
        cls,
        alert_id: int,
        symbol: str,
        alert_type: str,
        condition_payload: dict[str, Any],
        user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> "AlertCreated":
        payload = {
            "alert_id": alert_id,
            "symbol": symbol.upper(),
            "alert_type": alert_type,
            "condition_payload": condition_payload,
            "user_id": user_id,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="alert.created",
            aggregate_id=f"alert:{alert_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class AlertTriggered(DomainEvent):
    """Fired when market conditions satisfy an active alert's criteria."""

    @classmethod
    def create(
        cls,
        alert_id: int,
        symbol: str,
        alert_type: str,
        trigger_price: float | None,
        reason: str,
        user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> "AlertTriggered":
        payload = {
            "alert_id": alert_id,
            "symbol": symbol.upper(),
            "alert_type": alert_type,
            "trigger_price": trigger_price,
            "reason": reason,
            "user_id": user_id,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="alert.triggered",
            aggregate_id=f"alert:{alert_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class AlertEvaluated(DomainEvent):
    """Fired on every scheduled or manual evaluation pass of an alert."""

    @classmethod
    def create(
        cls,
        alert_id: int,
        symbol: str,
        triggered: bool,
        current_price: float | None,
        user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> "AlertEvaluated":
        payload = {
            "alert_id": alert_id,
            "symbol": symbol.upper(),
            "triggered": triggered,
            "current_price": current_price,
            "user_id": user_id,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="alert.evaluated",
            aggregate_id=f"alert:{alert_id}",
            payload=payload,
            metadata=meta,
        )


@dataclass(frozen=True)
class AlertDeleted(DomainEvent):
    """Fired when an alert is permanently removed."""

    @classmethod
    def create(
        cls,
        alert_id: int,
        user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> "AlertDeleted":
        payload = {
            "alert_id": alert_id,
            "user_id": user_id,
        }
        meta = {"user_id": user_id, **(metadata or {})}
        return cls(
            event_type="alert.deleted",
            aggregate_id=f"alert:{alert_id}",
            payload=payload,
            metadata=meta,
        )
