"""Deterministic cash-equity execution rules for Replay Lab."""

from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from api.models.intelligence import DecisionIntent, DecisionJournalEntry
from api.models.replay_lab import ReplayExecution, ReplayExecutionSide, ReplaySession
from api.services.replay_event_service import ReplayEventService


class ReplayExecutionService:
    VERSION = "REPLAY-EXECUTION-V1"

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.events = ReplayEventService(db, user_id)

    @staticmethod
    def d(value: Any) -> Decimal:
        return Decimal(str(value))

    def active_decision(self, session: ReplaySession) -> DecisionJournalEntry | None:
        return (
            self.db.query(DecisionJournalEntry)
            .filter(
                DecisionJournalEntry.user_id == self.user_id,
                DecisionJournalEntry.replay_session_id == session.id,
            )
            .order_by(DecisionJournalEntry.id.desc())
            .first()
        )

    def position(self, session: ReplaySession) -> dict[str, Any]:
        quantity = Decimal(0)
        total_cost = Decimal(0)
        realized = Decimal(0)
        for execution in sorted(session.executions, key=lambda item: item.id):
            qty = self.d(execution.quantity)
            price = self.d(execution.price)
            if execution.side == ReplayExecutionSide.BUY:
                total_cost += price * qty
                quantity += qty
            else:
                average = total_cost / quantity if quantity else Decimal(0)
                realized += (price - average) * qty
                total_cost -= average * qty
                quantity -= qty
        average_entry = total_cost / quantity if quantity else Decimal(0)
        return {
            "quantity": float(quantity),
            "average_entry": float(average_entry),
            "realized_pnl": float(realized),
            "is_open": quantity > 0,
        }

    def evaluate_new_candle(self, session: ReplaySession, candle: dict[str, Any]) -> str | None:
        decision = self.active_decision(session)
        if not decision:
            return None
        position = self.position(session)
        low = self.d(candle["low"])
        high = self.d(candle["high"])

        if not position["is_open"] and decision.intent in {DecisionIntent.ENTER, DecisionIntent.ADD}:
            zone_low = self.d(decision.entry_zone_low)
            zone_high = self.d(decision.entry_zone_high)
            if high >= zone_low and low <= zone_high:
                quantity = self.d((decision.risk_snapshot or {}).get("recommended_quantity", 0))
                if quantity > 0:
                    fill = zone_high
                    event = self.events.append(
                        session,
                        "POSITION_ACTIVATED",
                        payload={
                            "quantity": float(quantity),
                            "price": float(fill),
                            "policy": "conservative-zone-high",
                        },
                        decision_id=decision.id,
                    )
                    self.db.add(ReplayExecution(
                        session_id=session.id,
                        decision_id=decision.id,
                        event_id=event.id,
                        side=ReplayExecutionSide.BUY,
                        quantity=quantity,
                        price=fill,
                        replay_index=session.current_index,
                        simulated_at=session.current_market_time,
                        reason="ENTRY_TRIGGER",
                    ))
                    session.current_cash = self.d(session.current_cash) - fill * quantity
                    self.db.flush()
                    position = self.position(session)

        if not position["is_open"]:
            return None

        invalidation = self.d(decision.invalidation_price)
        target = self.d(decision.target_zone_low)
        both_touched = low <= invalidation and high >= target
        if low <= invalidation:
            return self.close_position(
                session,
                decision,
                invalidation,
                "INVALIDATION",
                ambiguity="adverse-first" if both_touched else None,
            )
        if high >= target:
            return self.close_position(session, decision, target, "TARGET")
        return None

    def close_position(
        self,
        session: ReplaySession,
        decision: DecisionJournalEntry,
        price: Decimal,
        reason: str,
        *,
        quantity: Decimal | None = None,
        ambiguity: str | None = None,
    ) -> str:
        position = self.position(session)
        open_quantity = self.d(position["quantity"])
        exit_quantity = min(quantity or open_quantity, open_quantity)
        if exit_quantity <= 0:
            return reason
        event_type = "POSITION_EXITED" if exit_quantity == open_quantity else "POSITION_REDUCED"
        event = self.events.append(
            session,
            event_type,
            payload={
                "quantity": float(exit_quantity),
                "price": float(price),
                "reason": reason,
                "ambiguity_policy": ambiguity,
            },
            decision_id=decision.id,
        )
        self.db.add(ReplayExecution(
            session_id=session.id,
            decision_id=decision.id,
            event_id=event.id,
            side=ReplayExecutionSide.SELL,
            quantity=exit_quantity,
            price=price,
            replay_index=session.current_index,
            simulated_at=session.current_market_time,
            reason=reason,
        ))
        session.current_cash = self.d(session.current_cash) + price * exit_quantity
        self.db.flush()
        return reason

