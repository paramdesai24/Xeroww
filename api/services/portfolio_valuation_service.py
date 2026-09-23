"""Decimal-based point-in-time portfolio valuation and snapshot persistence."""

import hashlib
import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.models.intelligence import DecisionJournalEntry, JournalStatus
from api.models.portfolio import Portfolio, PortfolioTransaction
from api.models.portfolio_intelligence import PortfolioSnapshot, PortfolioSnapshotHolding


MONEY = Decimal("0.01")


class PortfolioValuationService:
    VERSION = "PORTFOLIO-VALUATION-V1"
    BENCHMARK = "^NSEI"

    def __init__(self, db: Session, user_id: int, market_data):
        self.db = db
        self.user_id = user_id
        self.market_data = market_data

    @staticmethod
    def d(value: Any) -> Decimal:
        return Decimal(str(value))

    @staticmethod
    def money(value: Decimal) -> Decimal:
        return value.quantize(MONEY, rounding=ROUND_HALF_UP)

    def portfolio(self, portfolio_id: int) -> Portfolio:
        portfolio = (
            self.db.query(Portfolio)
            .filter(Portfolio.id == portfolio_id, Portfolio.user_id == self.user_id)
            .first()
        )
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PORTFOLIO_NOT_FOUND", "message": "Portfolio was not found."},
            )
        return portfolio

    def capture(self, portfolio_id: int) -> PortfolioSnapshot:
        portfolio = self.portfolio(portfolio_id)
        metadata = {item["symbol"]: item for item in self.market_data.get_stocks()}
        now = datetime.utcnow()
        rows: list[dict[str, Any]] = []
        missing: list[str] = []
        holdings_value = Decimal(0)
        total_cost = Decimal(0)

        for holding in portfolio.holdings:
            try:
                quote = self.market_data.get_quote(holding.symbol)
            except Exception:
                missing.append(holding.symbol)
                continue
            quantity = self.d(holding.quantity)
            average = self.d(holding.average_price)
            price = self.d(quote["price"])
            value = price * quantity
            cost = average * quantity
            holdings_value += value
            total_cost += cost
            quote_time = quote.get("timestamp")
            if isinstance(quote_time, str):
                quote_time = datetime.fromisoformat(quote_time.replace("Z", "+00:00")).replace(tzinfo=None)
            elif isinstance(quote_time, datetime) and quote_time.tzinfo:
                quote_time = quote_time.replace(tzinfo=None)
            rows.append({
                "symbol": holding.symbol,
                "sector": metadata.get(holding.symbol, {}).get("sector", "Unclassified"),
                "quantity": quantity,
                "average_price": average,
                "cost_basis": cost,
                "market_price": price,
                "market_value": value,
                "unrealized_pnl": value - cost,
                "data_as_of": quote_time,
                "is_stale": False,
            })

        cash = self.d(portfolio.cash_balance)
        total_value = cash + holdings_value
        realized = self.d(
            self.db.query(func.coalesce(func.sum(PortfolioTransaction.realized_pnl), 0))
            .filter(PortfolioTransaction.portfolio_id == portfolio.id)
            .scalar()
        )
        open_decisions = (
            self.db.query(DecisionJournalEntry)
            .filter(
                DecisionJournalEntry.user_id == self.user_id,
                DecisionJournalEntry.portfolio_id == portfolio.id,
                DecisionJournalEntry.status == JournalStatus.OPEN,
            )
            .count()
        )
        benchmark_close = None
        benchmark_note = None
        try:
            benchmark = self.market_data.get_benchmark_candles(self.BENCHMARK, period="1mo", interval="1d")
            benchmark_close = self.d(benchmark[-1]["close"]) if benchmark else None
        except Exception:
            benchmark_note = "Benchmark valuation is unavailable."

        canonical = {
            "portfolio_id": portfolio.id,
            "cash": str(cash),
            "holdings": [
                {key: str(value) if isinstance(value, Decimal) else value for key, value in row.items()}
                for row in sorted(rows, key=lambda item: item["symbol"])
            ],
            "benchmark_close": str(benchmark_close) if benchmark_close is not None else None,
            "version": self.VERSION,
        }
        fingerprint = hashlib.sha256(
            json.dumps(canonical, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        ).hexdigest()
        latest = (
            self.db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.portfolio_id == portfolio.id)
            .order_by(PortfolioSnapshot.as_of.desc())
            .first()
        )
        if latest and latest.source_fingerprint == fingerprint:
            return latest

        valuation_date = now.date()
        sequence = (
            self.db.query(func.max(PortfolioSnapshot.snapshot_sequence))
            .filter(
                PortfolioSnapshot.portfolio_id == portfolio.id,
                PortfolioSnapshot.valuation_date == valuation_date,
            )
            .scalar()
            or 0
        ) + 1
        quality = {
            "state": "PARTIAL" if missing else "COMPLETE",
            "missing_symbols": missing,
            "benchmark_note": benchmark_note,
            "observed_snapshot": True,
        }
        snapshot = PortfolioSnapshot(
            portfolio_id=portfolio.id,
            user_id=self.user_id,
            as_of=now,
            valuation_date=valuation_date,
            snapshot_sequence=sequence,
            cash=self.money(cash),
            holdings_value=self.money(holdings_value),
            total_value=self.money(total_value),
            cost_basis=self.money(total_cost),
            realized_pnl_to_date=self.money(realized),
            unrealized_pnl=self.money(holdings_value - total_cost),
            benchmark_symbol=self.BENCHMARK,
            benchmark_close=self.money(benchmark_close) if benchmark_close is not None else None,
            open_decision_count=open_decisions,
            data_quality=quality,
            source_fingerprint=fingerprint,
            valuation_version=self.VERSION,
        )
        self.db.add(snapshot)
        self.db.flush()
        for row in rows:
            weight = row["market_value"] / total_value if total_value > 0 else Decimal(0)
            self.db.add(PortfolioSnapshotHolding(
                snapshot_id=snapshot.id,
                portfolio_weight=weight,
                **row,
            ))
        self.db.commit()
        self.db.refresh(snapshot)
        self._publish(snapshot)
        return snapshot

    def _publish(self, snapshot: PortfolioSnapshot) -> None:
        try:
            from api.events import PortfolioIntelligenceEvent, get_event_bus
            get_event_bus().publish(PortfolioIntelligenceEvent.create(
                "snapshot_captured",
                snapshot.portfolio_id,
                self.user_id,
                {
                    "snapshot_id": snapshot.id,
                    "total_value": float(snapshot.total_value),
                    "data_quality": snapshot.data_quality.get("state"),
                },
            ))
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Portfolio snapshot event publication failed after commit")

    def latest(self, portfolio_id: int, *, capture_if_missing: bool = True) -> PortfolioSnapshot | None:
        self.portfolio(portfolio_id)
        snapshot = (
            self.db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.portfolio_id == portfolio_id, PortfolioSnapshot.user_id == self.user_id)
            .order_by(PortfolioSnapshot.as_of.desc())
            .first()
        )
        return snapshot or (self.capture(portfolio_id) if capture_if_missing else None)

    def list(self, portfolio_id: int, skip: int, limit: int) -> tuple[list[PortfolioSnapshot], int]:
        self.portfolio(portfolio_id)
        query = self.db.query(PortfolioSnapshot).filter(
            PortfolioSnapshot.portfolio_id == portfolio_id,
            PortfolioSnapshot.user_id == self.user_id,
        )
        return query.order_by(PortfolioSnapshot.as_of.desc()).offset(skip).limit(limit).all(), query.count()
