"""Application service for persisted, leak-safe Replay Lab sessions."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from api.models.intelligence import (
    DecisionDirection,
    DecisionIntent,
    DecisionJournalEntry,
    DecisionSource,
    JournalStatus,
)
from api.models.replay_lab import (
    ReplayCompletionReason,
    ReplaySession,
    ReplaySessionResult,
    ReplaySessionStatus,
)
from api.schemas.decision import DecisionCreateRequest, DecisionPlanBase
from api.schemas.replay_lab import ReplaySessionCreate
from api.services.behaviour_observation_service import BehaviourObservationService
from api.services.decision_snapshot_service import DecisionSnapshotService
from api.services.position_sizing_service import PositionSizingError, PositionSizingService
from api.services.replay_dataset_service import ReplayDatasetService
from api.services.replay_event_service import ReplayEventService
from api.services.replay_execution_service import ReplayExecutionService
from api.services.replay_scoring_service import ReplayScoringService
from api.services.replay_session_state_service import ReplaySessionStateService


class ReplaySessionService:
    def __init__(self, db: Session, user_id: int, market_data):
        self.db = db
        self.user_id = user_id
        self.market_data = market_data
        self.datasets = ReplayDatasetService(market_data)
        self.events = ReplayEventService(db, user_id)
        self.executions = ReplayExecutionService(db, user_id)
        self.snapshots = DecisionSnapshotService(market_data)

    @staticmethod
    def value(value: Any) -> Any:
        return getattr(value, "value", value)

    def create(self, data: ReplaySessionCreate) -> ReplaySession:
        resolved = self.datasets.resolve(
            symbol=data.symbol,
            randomize_symbol=data.randomize_symbol,
            start_date=data.start_date,
            randomize_start=data.randomize_start,
            timeframe=data.timeframe,
            session_bars=data.session_bars,
        )
        candles = resolved["candles"]
        start = resolved["start_index"]
        current_time = ReplayDatasetService.to_datetime(candles[start]["time"])
        session = ReplaySession(
            user_id=self.user_id,
            status=ReplaySessionStatus.SETUP,
            symbol=resolved["symbol"],
            symbol_was_randomized=data.randomize_symbol,
            start_was_randomized=data.randomize_start,
            hide_symbol=data.hide_symbol,
            hide_calendar_date=data.hide_calendar_date,
            timeframe=data.timeframe,
            source_period=resolved["source_period"],
            starting_capital=data.starting_capital,
            current_cash=data.starting_capital,
            maximum_risk_pct=data.maximum_risk_pct,
            setup_category=data.setup_category.strip() if data.setup_category else None,
            start_index=start,
            current_index=start,
            end_index=resolved["end_index"],
            warmup_start_index=resolved["warmup_start_index"],
            started_at_market_time=current_time,
            current_market_time=current_time,
            random_seed=resolved["random_seed"],
            dataset_fingerprint=resolved["fingerprint"],
            dataset_payload=candles,
            analytics_version=ReplaySessionStateService.VERSION,
            scoring_version=ReplayScoringService.VERSION,
            version=1,
        )
        self.db.add(session)
        self.db.flush()
        self.events.append(
            session,
            "SESSION_CREATED",
            payload={
                "timeframe": session.timeframe,
                "session_bars": data.session_bars,
                "symbol_randomized": data.randomize_symbol,
                "start_randomized": data.randomize_start,
            },
        )
        self.db.commit()
        self.db.refresh(session)
        self._publish("session_created", session)
        return session

    def get(self, session_id: int) -> ReplaySession:
        session = (
            self.db.query(ReplaySession)
            .filter(ReplaySession.id == session_id, ReplaySession.user_id == self.user_id)
            .first()
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "REPLAY_SESSION_NOT_FOUND", "message": "Replay session was not found."},
            )
        return session

    def list(self, skip: int, limit: int) -> tuple[list[ReplaySession], int]:
        query = self.db.query(ReplaySession).filter(ReplaySession.user_id == self.user_id)
        return query.order_by(ReplaySession.created_at.desc()).offset(skip).limit(limit).all(), query.count()

    def start(self, session_id: int, expected_version: int, idempotency_key: str) -> ReplaySession:
        session = self.get(session_id)
        duplicate = self.events.find_idempotent(session.id, idempotency_key)
        if duplicate:
            return session
        self._version(session, expected_version)
        if session.status != ReplaySessionStatus.SETUP:
            self._state_error("Only a setup session can be started.")
        session.status = ReplaySessionStatus.AWAITING_DECISION
        session.version += 1
        self.events.append(session, "SESSION_STARTED", idempotency_key=idempotency_key)
        self.events.append(session, "DECISION_REQUIRED")
        self.db.commit()
        self.db.refresh(session)
        self._publish("session_started", session)
        return session

    def preview_decision(self, session_id: int, data: DecisionPlanBase) -> dict[str, Any]:
        session = self.get(session_id)
        if session.status not in {ReplaySessionStatus.AWAITING_DECISION, ReplaySessionStatus.ACTIVE}:
            self._state_error("This session is not accepting a decision.")
        built = self._snapshot(session, data.direction)
        risk = self._risk(session, data)
        snapshot = built["snapshot"]
        warnings = list(risk.get("warnings", []))
        if snapshot["evidence"]["summary"] == "INSUFFICIENT_DATA":
            warnings.append("One or more analytical domains have insufficient data.")
        return {
            "symbol": session.symbol,
            "resolved_as_of": built["resolved_as_of"],
            "snapshot_hash": built["snapshot_hash"],
            "data_quality": snapshot["metadata"]["data_quality"],
            "evidence": snapshot["evidence"],
            "risk": risk,
            "warnings": warnings,
        }

    def submit_decision(self, session_id: int, data: DecisionCreateRequest) -> DecisionJournalEntry:
        session = self.get(session_id)
        if session.status != ReplaySessionStatus.AWAITING_DECISION:
            self._state_error("A decision can only be submitted at the decision gate.")
        built = self._snapshot(session, data.direction)
        if built["resolved_as_of"] != str(data.expected_as_of)[:10]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "REPLAY_VERSION_CONFLICT", "message": "The replay cursor changed after preview."},
            )
        snapshot = built["snapshot"]
        evidence = snapshot["evidence"]
        known = {item["key"] for item in evidence["items"]}
        supplied = set(data.supporting_evidence_keys) | set(data.conflicting_evidence_keys)
        if supplied - known:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "UNKNOWN_EVIDENCE_KEY", "message": "The decision contains unknown evidence keys."},
            )
        if evidence["counts"]["conflicting"] > 0 and not data.conflicts_reviewed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "CONFLICTS_NOT_REVIEWED", "message": "Review conflicting evidence before submitting."},
            )
        risk = self._risk(session, data)
        now = datetime.utcnow()
        entry = DecisionJournalEntry(
            user_id=self.user_id,
            symbol=session.symbol,
            timestamp=now,
            action=data.intent,
            thesis=data.thesis.strip(),
            context_snapshot=snapshot,
            status=JournalStatus.OPEN,
            ticket_version=1,
            direction=DecisionDirection(data.direction),
            intent=DecisionIntent(data.intent),
            holding_period=data.holding_period.strip(),
            setup_type=data.setup_type.strip(),
            entry_trigger=data.entry_trigger.strip() if data.entry_trigger else None,
            entry_zone_low=data.entry_zone_low,
            entry_zone_high=data.entry_zone_high,
            invalidation_price=data.invalidation_price,
            target_zone_low=data.target_zone_low,
            target_zone_high=data.target_zone_high,
            max_risk_pct=data.max_risk_pct,
            max_allocation_pct=data.max_allocation_pct,
            confidence=data.confidence,
            change_mind_condition=data.change_mind_condition.strip(),
            source_context=DecisionSource.REPLAY,
            source_as_of=session.current_market_time,
            source_period=session.source_period,
            snapshot_schema_version=1,
            snapshot_hash=built["snapshot_hash"],
            supporting_evidence_keys=data.supporting_evidence_keys,
            conflicting_evidence_keys=data.conflicting_evidence_keys,
            risk_snapshot=risk,
            submitted_at=now,
            version=1,
            replay_session_id=session.id,
            replay_index=session.current_index,
        )
        self.db.add(entry)
        self.db.flush()
        event = self.events.append(
            session,
            "DECISION_SUBMITTED",
            payload={"direction": data.direction, "intent": data.intent},
            decision_id=entry.id,
            evidence_snapshot_hash=entry.snapshot_hash,
        )
        entry.replay_event_sequence = event.sequence_number
        session.status = ReplaySessionStatus.ACTIVE
        session.version += 1
        self.db.commit()
        self.db.refresh(entry)
        self._publish("decision_submitted", session, {"decision_id": entry.id})
        return entry

    def advance(self, session_id: int, expected_version: int, idempotency_key: str) -> ReplaySession:
        session = self.get(session_id)
        duplicate = self.events.find_idempotent(session.id, idempotency_key)
        if duplicate:
            return session
        self._version(session, expected_version)
        if session.status == ReplaySessionStatus.AWAITING_DECISION:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "REPLAY_DECISION_REQUIRED", "message": "Submit a decision before revealing the next candle."},
            )
        if session.status != ReplaySessionStatus.ACTIVE:
            self._state_error("Only an active session can advance.")
        if session.current_index >= session.end_index:
            return self._complete(session, ReplayCompletionReason.PERIOD_END)

        session.current_index += 1
        candle = session.dataset_payload[session.current_index]
        session.current_market_time = ReplayDatasetService.to_datetime(candle["time"])
        session.version += 1
        self.events.append(
            session,
            "CANDLE_REVEALED",
            payload={"visible_step": session.current_index - session.start_index},
            idempotency_key=idempotency_key,
        )
        completion = self.executions.evaluate_new_candle(session, candle)
        if completion == "INVALIDATION":
            self._complete(session, ReplayCompletionReason.INVALIDATION, commit=False)
        elif completion == "TARGET":
            self._complete(session, ReplayCompletionReason.TARGET, commit=False)
        elif session.current_index >= session.end_index:
            position = self.executions.position(session)
            decision = self.executions.active_decision(session)
            if position["is_open"] and decision:
                self.executions.close_position(
                    session,
                    decision,
                    Decimal(str(candle["close"])),
                    "PERIOD_END",
                )
                self._complete(session, ReplayCompletionReason.PERIOD_END, commit=False)
            else:
                self._complete(session, ReplayCompletionReason.NO_ENTRY, commit=False)
        self.db.commit()
        self.db.refresh(session)
        self._publish("candle_revealed", session)
        if session.status == ReplaySessionStatus.COMPLETED:
            self._publish("session_completed", session, {"completion_reason": self.value(session.completion_reason)})
            self._publish("score_calculated", session, {"process_score": float(session.result.process_score) if session.result else None})
        return session

    def pause(self, session_id: int, expected_version: int, idempotency_key: str) -> ReplaySession:
        session = self.get(session_id)
        if self.events.find_idempotent(session.id, idempotency_key):
            return session
        self._version(session, expected_version)
        if session.status not in {ReplaySessionStatus.ACTIVE, ReplaySessionStatus.AWAITING_DECISION}:
            self._state_error("This session cannot be paused.")
        session.status = ReplaySessionStatus.PAUSED
        session.version += 1
        self.events.append(session, "SESSION_PAUSED", idempotency_key=idempotency_key)
        self.db.commit()
        self.db.refresh(session)
        self._publish("session_paused", session)
        return session

    def resume(self, session_id: int, expected_version: int, idempotency_key: str) -> ReplaySession:
        session = self.get(session_id)
        if self.events.find_idempotent(session.id, idempotency_key):
            return session
        self._version(session, expected_version)
        if session.status != ReplaySessionStatus.PAUSED:
            self._state_error("Only a paused session can be resumed.")
        session.status = ReplaySessionStatus.ACTIVE if self.executions.active_decision(session) else ReplaySessionStatus.AWAITING_DECISION
        session.version += 1
        self.events.append(session, "SESSION_RESUMED", idempotency_key=idempotency_key)
        self.db.commit()
        self.db.refresh(session)
        self._publish("session_resumed", session)
        return session

    def reflect(self, session_id: int, data) -> ReplaySession:
        session = self.get(session_id)
        if self.events.find_idempotent(session.id, data.idempotency_key):
            return session
        self._version(session, data.expected_version)
        self.events.append(
            session,
            "BEHAVIOUR_RESPONSE_RECORDED",
            payload={"prompt_key": data.prompt_key, "response": data.response.strip(), "phase": data.phase},
            idempotency_key=data.idempotency_key,
        )
        session.version += 1
        self.db.commit()
        self.db.refresh(session)
        if session.status == ReplaySessionStatus.COMPLETED:
            self._calculate_result(session)
            self.db.commit()
            self.db.refresh(session)
            self._publish("score_calculated", session, {"process_score": float(session.result.process_score) if session.result else None})
        return session

    def exit(self, session_id: int, data) -> ReplaySession:
        session = self.get(session_id)
        if self.events.find_idempotent(session.id, data.idempotency_key):
            return session
        self._version(session, data.expected_version)
        if session.status != ReplaySessionStatus.ACTIVE:
            self._state_error("Only an active session can record an exit.")
        decision = self.executions.active_decision(session)
        position = self.executions.position(session)
        if not decision or not position["is_open"]:
            self._state_error("There is no open replay position to exit.")
        candle = session.dataset_payload[session.current_index]
        reason = data.reason_category
        self.executions.close_position(
            session,
            decision,
            Decimal(str(candle["close"])),
            reason,
            quantity=Decimal(str(data.quantity)) if data.quantity else None,
        )
        self.events.append(
            session,
            "USER_EXIT_RECORDED",
            payload={
                "reason": reason,
                "explanation": data.explanation,
                "evidence_keys": data.evidence_keys,
            },
            decision_id=decision.id,
            idempotency_key=data.idempotency_key,
        )
        session.version += 1
        if not self.executions.position(session)["is_open"]:
            self._complete(session, ReplayCompletionReason.USER_EXIT, commit=False)
        self.db.commit()
        self.db.refresh(session)
        self._publish("position_exited", session, {"reason": reason})
        if session.status == ReplaySessionStatus.COMPLETED:
            self._publish("session_completed", session, {"completion_reason": self.value(session.completion_reason)})
        return session

    def abandon(self, session_id: int, expected_version: int, idempotency_key: str) -> ReplaySession:
        session = self.get(session_id)
        if self.events.find_idempotent(session.id, idempotency_key):
            return session
        self._version(session, expected_version)
        if session.status in {ReplaySessionStatus.COMPLETED, ReplaySessionStatus.ABANDONED}:
            self._state_error("This session is already terminal.")
        session.status = ReplaySessionStatus.ABANDONED
        session.completion_reason = ReplayCompletionReason.ABANDONED
        session.completed_at = datetime.utcnow()
        session.ended_at_market_time = session.current_market_time
        session.version += 1
        self.events.append(session, "SESSION_ABANDONED", idempotency_key=idempotency_key)
        self.db.commit()
        self.db.refresh(session)
        self._publish("session_abandoned", session)
        return session

    def state(self, session: ReplaySession) -> dict[str, Any]:
        decision = self.executions.active_decision(session)
        return ReplaySessionStateService.build(
            session,
            active_decision_id=decision.id if decision else None,
            position=self.executions.position(session),
        )

    def review(self, session_id: int) -> dict[str, Any]:
        session = self.get(session_id)
        if session.status != ReplaySessionStatus.COMPLETED:
            self._state_error("Review is available after session completion.")
        if not session.result:
            self._calculate_result(session)
        return {
            "session": self.summary(session),
            "process": {
                "score": float(session.result.process_score) if session.result.process_score is not None else None,
                "grade": session.result.process_grade,
                "components": session.result.process_components,
                "version": session.result.scoring_version,
            },
            "outcome": session.result.outcome_metrics,
            "behaviour_observations": session.result.behaviour_observations,
            "events": session.events,
        }

    def summary(self, session: ReplaySession) -> dict[str, Any]:
        return {
            "id": session.id,
            "status": self.value(session.status),
            "symbol": session.symbol,
            "timeframe": session.timeframe,
            "setup_category": session.setup_category,
            "current_index": session.current_index,
            "start_index": session.start_index,
            "end_index": session.end_index,
            "current_market_time": session.current_market_time,
            "completion_reason": self.value(session.completion_reason),
            "process_score": session.result.process_score if session.result else None,
            "version": session.version,
            "created_at": session.created_at,
        }

    def _snapshot(self, session: ReplaySession, direction: str) -> dict[str, Any]:
        visible_with_warmup = session.dataset_payload[session.warmup_start_index : session.current_index + 1]
        return self.snapshots.build_from_candles(
            symbol=session.symbol,
            candles=visible_with_warmup,
            direction=direction,
            as_of=session.current_market_time.isoformat(),
            timeframe=session.timeframe,
            period=session.source_period,
        )

    @staticmethod
    def _risk(session: ReplaySession, data: DecisionPlanBase) -> dict[str, Any]:
        try:
            return PositionSizingService.calculate(
                intent=data.intent,
                capital_base=session.starting_capital,
                entry_zone_low=data.entry_zone_low,
                entry_zone_high=data.entry_zone_high,
                invalidation_price=data.invalidation_price,
                target_zone_low=data.target_zone_low,
                max_risk_pct=min(Decimal(str(data.max_risk_pct or session.maximum_risk_pct)), session.maximum_risk_pct),
                max_allocation_pct=data.max_allocation_pct,
                available_cash=session.current_cash,
            )
        except PositionSizingError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_PRICE_PLAN", "message": str(exc)},
            ) from exc

    def _complete(self, session: ReplaySession, reason: ReplayCompletionReason, *, commit: bool = True) -> ReplaySession:
        session.status = ReplaySessionStatus.COMPLETED
        session.completion_reason = reason
        session.completed_at = datetime.utcnow()
        session.ended_at_market_time = session.current_market_time
        session.version += 1
        self.events.append(session, "SESSION_COMPLETED", payload={"reason": reason.value})
        self.db.flush()
        self._calculate_result(session)
        if commit:
            self.db.commit()
            self.db.refresh(session)
        return session

    def _calculate_result(self, session: ReplaySession) -> None:
        decision = self.executions.active_decision(session)
        if not decision:
            return
        self.db.expire(session, ["events", "executions"])
        calculated = ReplayScoringService.calculate(session, decision, session.events, session.executions)
        observations = BehaviourObservationService.build(
            self.db.query(ReplaySession).filter(ReplaySession.user_id == self.user_id).all()
        )
        result = session.result or ReplaySessionResult(session_id=session.id)
        result.process_score = calculated["process_score"]
        result.process_grade = calculated["process_grade"]
        result.process_components = calculated["process_components"]
        result.outcome_metrics = calculated["outcome_metrics"]
        result.behaviour_observations = observations
        result.calculation_inputs_hash = calculated["calculation_inputs_hash"]
        result.scoring_version = calculated["scoring_version"]
        self.db.add(result)
        self.db.flush()

    @staticmethod
    def _version(session: ReplaySession, expected: int) -> None:
        if session.version != expected:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "REPLAY_VERSION_CONFLICT", "message": "The session changed. Reload before retrying."},
            )

    @staticmethod
    def _state_error(message: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "REPLAY_INVALID_STATE", "message": message},
        )

    @staticmethod
    def _publish(action: str, session: ReplaySession, payload: dict[str, Any] | None = None) -> None:
        try:
            from api.events import ReplayLabEvent, get_event_bus
            get_event_bus().publish(ReplayLabEvent.create(action, session, payload))
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Replay event publication failed after commit")
