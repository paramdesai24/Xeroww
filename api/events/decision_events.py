"""Safe summary events for the Decision Workbench lifecycle."""

from dataclasses import dataclass

from api.events.base import DomainEvent


@dataclass(frozen=True)
class DecisionTicketEvent(DomainEvent):
    @classmethod
    def create(cls, *, action: str, entry) -> "DecisionTicketEvent":
        return cls(
            event_type=f"decision.ticket_{action}",
            aggregate_id=f"decision:{entry.id}",
            payload={
                "decision_id": entry.id,
                "symbol": entry.symbol,
                "status": getattr(entry.status, "value", entry.status),
                "version": entry.version,
            },
            metadata={"user_id": entry.user_id},
        )
