"""Versioned process scoring and separate outcome metrics for replay sessions."""

import hashlib
import json
from decimal import Decimal
from typing import Any


class ReplayScoringService:
    VERSION = "process-v1"

    @staticmethod
    def _event_types(events) -> list[str]:
        return [event.event_type for event in events]

    @classmethod
    def calculate(cls, session, decision, events, executions) -> dict[str, Any]:
        event_types = cls._event_types(events)
        risk = decision.risk_snapshot or {}
        conflicts = list(decision.conflicting_evidence_keys or [])
        amendments = [event for event in events if event.event_type == "DECISION_AMENDED"]
        widened = any(bool(event.payload.get("risk_widened")) for event in amendments)
        entry = next((item for item in executions if getattr(item.side, "value", item.side) == "BUY"), None)
        exits = [item for item in executions if getattr(item.side, "value", item.side) == "SELL"]
        exited = exits[-1] if exits else None

        components = {
            "plan_and_evidence": cls._component(
                20,
                bool(decision.thesis and decision.change_mind_condition) and (not conflicts or bool(decision.conflicting_evidence_keys)),
                "Plan recorded and contradictory evidence reviewed",
            ),
            "risk_and_size": cls._component(
                20,
                bool(risk.get("complete")) and int(risk.get("recommended_quantity", 0)) > 0,
                "Position size remained within server-verified limits",
            ),
            "invalidation_discipline": cls._component(
                20,
                not widened,
                "Original invalidation was not widened",
            ),
            "amendment_discipline": cls._component(
                15,
                all(bool(event.payload.get("reason")) for event in amendments),
                "Every plan change was recorded with a reason",
            ),
            "entry_adherence": cls._component(
                10,
                entry is None or entry.reason == "ENTRY_TRIGGER",
                "Entry followed the documented trigger and zone",
            ),
            "exit_adherence": cls._component(
                10,
                exited is None or exited.reason in {"TARGET", "INVALIDATION", "EVIDENCE", "PERIOD_END"},
                "Exit followed a documented plan or evidence rule",
            ),
            "reflection_completion": cls._component(
                5,
                "BEHAVIOUR_RESPONSE_RECORDED" in event_types,
                "At least one reflection was completed",
            ),
        }
        score = sum(item["earned"] for item in components.values())
        outcome = cls._outcome(session, decision, executions)
        source = {
            "session_id": session.id,
            "event_ids": [event.id for event in events],
            "execution_ids": [execution.id for execution in executions],
            "decision_hash": decision.snapshot_hash,
            "version": cls.VERSION,
        }
        inputs_hash = hashlib.sha256(
            json.dumps(source, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        ).hexdigest()
        return {
            "process_score": score,
            "process_grade": cls._grade(score),
            "process_components": components,
            "outcome_metrics": outcome,
            "calculation_inputs_hash": inputs_hash,
            "scoring_version": cls.VERSION,
        }

    @staticmethod
    def _component(maximum: int, passed: bool, explanation: str) -> dict[str, Any]:
        return {
            "earned": maximum if passed else 0,
            "maximum": maximum,
            "status": "MET" if passed else "NOT_MET",
            "short_explanation": explanation,
        }

    @staticmethod
    def _grade(score: int) -> str:
        if score >= 90:
            return "EXCELLENT"
        if score >= 75:
            return "DISCIPLINED"
        if score >= 60:
            return "DEVELOPING"
        return "REVIEW_REQUIRED"

    @staticmethod
    def _outcome(session, decision, executions) -> dict[str, Any]:
        buys = [item for item in executions if getattr(item.side, "value", item.side) == "BUY"]
        sells = [item for item in executions if getattr(item.side, "value", item.side) == "SELL"]
        if not buys:
            return {"applicable": False, "reason": "The entry trigger was not activated."}
        buy_qty = sum(Decimal(str(item.quantity)) for item in buys)
        entry = sum(Decimal(str(item.quantity)) * Decimal(str(item.price)) for item in buys) / buy_qty
        invalidation = Decimal(str(decision.invalidation_price))
        initial_risk = entry - invalidation
        candles = list(session.dataset_payload or [])
        entry_index = min(item.replay_index for item in buys)
        end_index = max([item.replay_index for item in sells], default=session.current_index)
        active = candles[entry_index : end_index + 1]
        maximum_high = max(Decimal(str(candle["high"])) for candle in active)
        minimum_low = min(Decimal(str(candle["low"])) for candle in active)
        result: dict[str, Any] = {
            "applicable": True,
            "entry_price": float(entry),
            "quantity": float(buy_qty),
            "planned_risk_amount": (decision.risk_snapshot or {}).get("maximum_risk_amount"),
            "actual_initial_risk_amount": float(initial_risk * buy_qty),
            "reward_to_risk_at_entry": (decision.risk_snapshot or {}).get("reward_to_risk"),
            "maximum_favourable_excursion_r": float((maximum_high - entry) / initial_risk),
            "maximum_adverse_excursion_r": float((minimum_low - entry) / initial_risk),
            "bars_held": max(0, end_index - entry_index),
            "target_reached": any(item.reason == "TARGET" for item in sells),
            "invalidation_reached": any(item.reason == "INVALIDATION" for item in sells),
        }
        if sells:
            sell_qty = sum(Decimal(str(item.quantity)) for item in sells)
            exit_price = sum(Decimal(str(item.quantity)) * Decimal(str(item.price)) for item in sells) / sell_qty
            realized = (exit_price - entry) * sell_qty
            result.update({
                "exit_price": float(exit_price),
                "realized_pnl": float(realized),
                "realized_r_multiple": float((exit_price - entry) / initial_risk),
                "exit_reason": sells[-1].reason,
            })
        return result

