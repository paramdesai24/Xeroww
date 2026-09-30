"""Application service for Decision Workbench operations."""

from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from api.models.intelligence import (
    AmendmentType,
    DecisionDirection,
    DecisionIntent,
    DecisionJournalEntry,
    DecisionSource,
    DecisionTicketAmendment,
    JournalStatus,
)
from api.models.portfolio import Portfolio
from api.schemas.decision import (
    DecisionAmendmentCreate,
    DecisionCreateRequest,
    DecisionPlanBase,
    DecisionStatusChange,
)
from api.services.decision_snapshot_service import DecisionSnapshotService
from api.services.position_sizing_service import PositionSizingError, PositionSizingService


class DecisionService:
    def __init__(self, db: Session, user_id: int, market_data):
        self.db = db
        self.user_id = user_id
        self.market_data = market_data
        self.snapshots = DecisionSnapshotService(market_data)

    @staticmethod
    def _value(value: Any) -> Any:
        return getattr(value, "value", value)

    @staticmethod
    def _as_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed

    def _portfolio_context(self, portfolio_id: int | None) -> tuple[float | None, float | None]:
        if portfolio_id is None:
            return None, None
        portfolio = (
            self.db.query(Portfolio)
            .filter(Portfolio.id == portfolio_id, Portfolio.user_id == self.user_id)
            .first()
        )
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PORTFOLIO_NOT_FOUND", "message": "Portfolio was not found for the current user."},
            )
        holdings_value = 0.0
        for holding in portfolio.holdings:
            try:
                holdings_value += float(self.market_data.get_quote(holding.symbol)["price"]) * holding.quantity
            except Exception:
                holdings_value += holding.average_price * holding.quantity
        return float(portfolio.cash_balance + holdings_value), float(portfolio.cash_balance)

    def _risk(self, data: DecisionPlanBase) -> dict[str, Any]:
        portfolio_capital, available_cash = self._portfolio_context(data.portfolio_id)
        capital = portfolio_capital if portfolio_capital is not None else data.capital_base
        try:
            risk = PositionSizingService.calculate(
                intent=data.intent,
                capital_base=capital,
                entry_zone_low=data.entry_zone_low,
                entry_zone_high=data.entry_zone_high,
                invalidation_price=data.invalidation_price,
                target_zone_low=data.target_zone_low,
                max_risk_pct=data.max_risk_pct,
                max_allocation_pct=data.max_allocation_pct,
                available_cash=available_cash,
            )
            if data.portfolio_id and risk.get("complete") and risk.get("recommended_quantity", 0) > 0:
                from api.services.portfolio_impact_service import PortfolioImpactService
                from api.services.portfolio_risk_policy_service import PortfolioRiskPolicyService
                from api.services.portfolio_valuation_service import PortfolioValuationService

                snapshot = PortfolioValuationService(
                    self.db, self.user_id, self.market_data
                ).latest(data.portfolio_id)
                policy = PortfolioRiskPolicyService(self.db, self.user_id).get(data.portfolio_id)
                normalized_symbol = self.market_data.normalize_symbol(data.symbol)
                impact = PortfolioImpactService(self.market_data).build(
                    snapshot,
                    policy,
                    symbol=normalized_symbol,
                    quantity=risk["recommended_quantity"],
                    entry_price=risk["planned_entry_price"],
                    invalidation_price=data.invalidation_price,
                )
                risk["portfolio_impact"] = impact
                risk.setdefault("warnings", []).extend(
                    f"{item['code'].replace('_', ' ').title()}: {item['subject']} is {item['actual']:.2f} versus a {item['threshold']:.2f} threshold."
                    for item in impact.get("warnings", [])
                )
            return risk
        except PositionSizingError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_PRICE_PLAN", "message": str(exc)},
            ) from exc

    def preview(self, data: DecisionPlanBase) -> dict[str, Any]:
        built = self.snapshots.build(
            symbol=data.symbol,
            direction=data.direction,
            source_context=data.source_context,
            as_of=data.source_as_of,
            period=data.source_period,
        )
        snapshot = built["snapshot"]
        risk = self._risk(data)
        warnings = list(risk.get("warnings", []))
        if snapshot["evidence"]["summary"] == "INSUFFICIENT_DATA":
            warnings.append("One or more analytical domains have insufficient data.")
        return {
            "symbol": snapshot["structure"]["symbol"],
            "resolved_as_of": built["resolved_as_of"],
            "snapshot_hash": built["snapshot_hash"],
            "data_quality": snapshot["metadata"]["data_quality"],
            "evidence": snapshot["evidence"],
            "risk": risk,
            "warnings": warnings,
        }

    def create(self, data: DecisionCreateRequest) -> DecisionJournalEntry:
        built = self.snapshots.build(
            symbol=data.symbol,
            direction=data.direction,
            source_context=data.source_context,
            as_of=data.source_as_of,
            period=data.source_period,
        )
        if built["resolved_as_of"] != str(data.expected_as_of)[:10]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "MARKET_CONTEXT_CHANGED",
                    "message": "The market context changed after preview. Review the refreshed evidence before submitting.",
                    "resolved_as_of": built["resolved_as_of"],
                },
            )

        snapshot = built["snapshot"]
        evidence = snapshot["evidence"]
        known_keys = {item["key"] for item in evidence["items"]}
        supplied = set(data.supporting_evidence_keys) | set(data.conflicting_evidence_keys)
        unknown = sorted(supplied - known_keys)
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "UNKNOWN_EVIDENCE_KEY", "message": f"Unknown evidence keys: {', '.join(unknown)}"},
            )
        if evidence["counts"]["conflicting"] > 0 and not data.conflicts_reviewed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "CONFLICTS_NOT_REVIEWED", "message": "Review conflicting evidence before submitting."},
            )

        risk = self._risk(data)
        impact = risk.get("portfolio_impact")
        if data.expected_portfolio_snapshot_id and (
            not impact or impact.get("portfolio_snapshot_id") != data.expected_portfolio_snapshot_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "PORTFOLIO_CONTEXT_CHANGED",
                    "message": "The portfolio changed after preview. Review the refreshed impact before submitting.",
                },
            )
        now = datetime.utcnow()
        source_as_of = self._as_datetime(built["resolved_as_of"])
        entry = DecisionJournalEntry(
            user_id=self.user_id,
            symbol=snapshot["structure"]["symbol"],
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
            portfolio_id=data.portfolio_id,
            source_context=DecisionSource(data.source_context),
            source_as_of=source_as_of,
            source_period=data.source_period,
            snapshot_schema_version=1,
            snapshot_hash=built["snapshot_hash"],
            supporting_evidence_keys=data.supporting_evidence_keys,
            conflicting_evidence_keys=data.conflicting_evidence_keys,
            risk_snapshot=risk,
            submitted_at=now,
            version=1,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        self._publish("submitted", entry)
        return entry

    def get_or_404(self, decision_id: int) -> DecisionJournalEntry:
        entry = (
            self.db.query(DecisionJournalEntry)
            .filter(DecisionJournalEntry.id == decision_id, DecisionJournalEntry.user_id == self.user_id)
            .first()
        )
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DECISION_NOT_FOUND", "message": "Decision was not found."},
            )
        return entry

    def list(self, *, skip: int, limit: int, status_filter: str | None, symbol: str | None, direction: str | None, intent: str | None, source_context: str | None) -> tuple[list[DecisionJournalEntry], int]:
        query = self.db.query(DecisionJournalEntry).filter(DecisionJournalEntry.user_id == self.user_id)
        if status_filter:
            query = query.filter(DecisionJournalEntry.status == JournalStatus(status_filter))
        if symbol:
            query = query.filter(DecisionJournalEntry.symbol == symbol.strip().upper())
        if direction:
            query = query.filter(DecisionJournalEntry.direction == DecisionDirection(direction))
        if intent:
            query = query.filter(DecisionJournalEntry.intent == DecisionIntent(intent))
        if source_context:
            query = query.filter(DecisionJournalEntry.source_context == DecisionSource(source_context))
        total = query.count()
        items = query.order_by(DecisionJournalEntry.timestamp.desc()).offset(skip).limit(limit).all()
        return items, total

    def add_amendment(self, decision_id: int, data: DecisionAmendmentCreate) -> DecisionJournalEntry:
        entry = self.get_or_404(decision_id)
        self._check_version(entry, data.expected_version)
        amendment = DecisionTicketAmendment(
            decision_id=entry.id,
            user_id=self.user_id,
            amendment_type=AmendmentType(data.amendment_type),
            reason=data.reason.strip(),
            payload=data.payload,
        )
        entry.version += 1
        self.db.add(amendment)
        self.db.commit()
        self.db.refresh(entry)
        self._publish("amended", entry)
        return entry

    def transition_status(self, decision_id: int, data: DecisionStatusChange) -> DecisionJournalEntry:
        entry = self.get_or_404(decision_id)
        self._check_version(entry, data.expected_version)
        if entry.status != JournalStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "INVALID_STATUS_TRANSITION", "message": "Closed or cancelled decisions cannot be changed."},
            )
        old = entry.status.value
        entry.status = JournalStatus(data.status)
        entry.closed_at = datetime.utcnow()
        entry.version += 1
        self.db.add(DecisionTicketAmendment(
            decision_id=entry.id,
            user_id=self.user_id,
            amendment_type=AmendmentType.STATUS_CHANGE,
            reason=data.reason.strip(),
            payload={},
            from_status=old,
            to_status=data.status,
        ))
        self.db.commit()
        self.db.refresh(entry)
        self._publish(data.status.lower(), entry)
        return entry

    @staticmethod
    def summary(entry: DecisionJournalEntry) -> dict[str, Any]:
        snapshot = entry.context_snapshot or {}
        evidence = snapshot.get("evidence", {})
        quality = snapshot.get("metadata", {}).get("data_quality", {})
        return {
            "id": entry.id,
            "symbol": entry.symbol,
            "direction": DecisionService._value(entry.direction),
            "intent": DecisionService._value(entry.intent) or entry.action,
            "status": DecisionService._value(entry.status),
            "confidence": entry.confidence,
            "holding_period": entry.holding_period,
            "source_context": DecisionService._value(entry.source_context),
            "source_as_of": entry.source_as_of,
            "timestamp": entry.timestamp,
            "ticket_version": entry.ticket_version,
            "evidence_summary": evidence.get("summary"),
            "evidence_counts": evidence.get("counts", {}),
            "data_quality": quality.get("state"),
        }

    @staticmethod
    def detail(entry: DecisionJournalEntry) -> dict[str, Any]:
        fields = (
            "id", "symbol", "holding_period", "setup_type", "entry_trigger", "entry_zone_low",
            "entry_zone_high", "invalidation_price", "target_zone_low", "target_zone_high",
            "max_risk_pct", "max_allocation_pct", "confidence", "thesis", "change_mind_condition",
            "portfolio_id", "replay_session_id", "replay_event_sequence", "replay_index",
            "source_as_of", "source_period", "ticket_version", "snapshot_hash",
            "context_snapshot", "risk_snapshot", "supporting_evidence_keys", "conflicting_evidence_keys",
            "submitted_at", "closed_at", "timestamp", "created_at", "version",
        )
        result = {field: getattr(entry, field) for field in fields}
        result.update({
            "direction": DecisionService._value(entry.direction),
            "intent": DecisionService._value(entry.intent) or entry.action,
            "source_context": DecisionService._value(entry.source_context),
            "status": DecisionService._value(entry.status),
            "amendments": entry.amendments,
        })
        return result

    @staticmethod
    def _check_version(entry: DecisionJournalEntry, expected: int) -> None:
        if entry.version != expected:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DECISION_VERSION_CONFLICT", "message": "The decision changed. Reload before trying again."},
            )

    @staticmethod
    def _publish(action: str, entry: DecisionJournalEntry) -> None:
        try:
            from api.events import get_event_bus
            from api.events.decision_events import DecisionTicketEvent
            get_event_bus().publish(DecisionTicketEvent.create(action=action, entry=entry))
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Decision event publication failed after commit")
