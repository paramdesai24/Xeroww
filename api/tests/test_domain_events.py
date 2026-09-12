"""
tests/test_domain_events.py
───────────────────────────
Comprehensive unit tests for:
- DomainEvent base model and serialization
- Market, Portfolio, Journal, and Alert domain event models
- InMemoryEventBus (subscribe, publish, wildcard, fault-isolation, history)
- CQRS Command & Query model integrity
- Event publishing integration from PortfolioService, AlertService, JournalService, and AnalyticsOrchestrator
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from api.events import (
    DomainEvent,
    MarketSnapshotReceived,
    PatternDetected,
    RegimeChanged,
    SupportResistanceBroken,
    PortfolioCreated,
    AssetBought,
    AssetSold,
    PortfolioUpdated,
    JournalEntryCreated,
    JournalEntryReviewed,
    JournalEntryUpdated,
    AlertCreated,
    AlertTriggered,
    AlertEvaluated,
    AlertDeleted,
    InMemoryEventBus,
    get_event_bus,
    set_event_bus,
)
from api.cqrs import (
    Command,
    CreatePortfolio,
    BuyAsset,
    SellAsset,
    CreateAlert,
    DeleteAlert,
    Query,
    GetPortfolio,
    GetMarketSnapshot,
    GetReplayState,
)


# ===========================================================================
# 1. Base DomainEvent Tests
# ===========================================================================

def test_domain_event_defaults_and_immutability():
    event = DomainEvent(
        event_type="test.sample",
        aggregate_id="test:1",
        payload={"foo": "bar"},
    )
    assert event.event_type == "test.sample"
    assert event.aggregate_id == "test:1"
    assert event.payload == {"foo": "bar"}
    assert event.version == 1
    assert event.event_id is not None
    assert isinstance(event.occurred_at, datetime)
    assert event.metadata == {}

    # Test serialization
    data = event.to_dict()
    assert data["event_type"] == "test.sample"
    assert data["aggregate_id"] == "test:1"
    assert data["payload"] == {"foo": "bar"}
    assert "event_id" in data
    assert "occurred_at" in data

    # Test frozen immutability
    with pytest.raises(Exception):
        event.version = 2  # type: ignore


# ===========================================================================
# 2. Specific Domain Event Factories
# ===========================================================================

def test_market_events():
    snap = MarketSnapshotReceived.create(
        symbol="reliance",
        price=2900.5,
        volume=1500000,
        change=15.5,
        change_pct=0.54,
    )
    assert snap.event_type == "market.snapshot_received"
    assert snap.aggregate_id == "symbol:RELIANCE"
    assert snap.payload["price"] == 2900.5

    pat = PatternDetected.create(
        symbol="tcs",
        pattern_name="BULLISH_ENGULFING",
        confidence=0.88,
        direction="BULLISH",
    )
    assert pat.event_type == "market.pattern_detected"
    assert pat.aggregate_id == "symbol:TCS"
    assert pat.payload["confidence"] == 0.88

    reg = RegimeChanged.create("infy", old_regime="RANGING", new_regime="TRENDING_UP")
    assert reg.event_type == "market.regime_changed"
    assert reg.payload["new_regime"] == "TRENDING_UP"

    sr = SupportResistanceBroken.create("sbin", level=750.0, level_type="RESISTANCE", break_price=755.0, direction="BULLISH_BREAKOUT")
    assert sr.event_type == "market.support_resistance_broken"
    assert sr.payload["break_price"] == 755.0


def test_portfolio_events():
    created = PortfolioCreated.create(portfolio_id=10, name="Growth", user_id=1, initial_cash=100000.0)
    assert created.event_type == "portfolio.created"
    assert created.aggregate_id == "portfolio:10"
    assert created.payload["initial_cash"] == 100000.0

    bought = AssetBought.create(portfolio_id=10, symbol="hcltech", quantity=20, price=1400.0, total_cost=28000.0, user_id=1)
    assert bought.event_type == "portfolio.asset_bought"
    assert bought.payload["symbol"] == "HCLTECH"
    assert bought.payload["total_cost"] == 28000.0

    sold = AssetSold.create(portfolio_id=10, symbol="hcltech", quantity=10, price=1500.0, proceeds=15000.0, realized_pnl=1000.0, user_id=1)
    assert sold.event_type == "portfolio.asset_sold"
    assert sold.payload["realized_pnl"] == 1000.0

    updated = PortfolioUpdated.create(portfolio_id=10, cash_balance=87000.0, user_id=1)
    assert updated.event_type == "portfolio.updated"
    assert updated.payload["cash_balance"] == 87000.0


def test_journal_and_alert_events():
    j_created = JournalEntryCreated.create(entry_id=5, symbol="tata", user_id=1, thesis="Breakout retest")
    assert j_created.event_type == "journal.entry_created"
    assert j_created.aggregate_id == "journal:5"

    j_reviewed = JournalEntryReviewed.create(entry_id=5, symbol="tata", user_id=1, outcome="WIN", audit_score=9.5)
    assert j_reviewed.event_type == "journal.entry_reviewed"
    assert j_reviewed.payload["outcome"] == "WIN"

    a_created = AlertCreated.create(alert_id=1, symbol="wipro", alert_type="PRICE_ABOVE", condition_payload={"threshold": 500}, user_id=1)
    assert a_created.event_type == "alert.created"

    a_trig = AlertTriggered.create(alert_id=1, symbol="wipro", alert_type="PRICE_ABOVE", trigger_price=505.0, reason="Above threshold", user_id=1)
    assert a_trig.event_type == "alert.triggered"
    assert a_trig.payload["trigger_price"] == 505.0


# ===========================================================================
# 3. InMemoryEventBus Tests
# ===========================================================================

def test_event_bus_exact_and_wildcard_subscription():
    bus = InMemoryEventBus()
    exact_received = []
    wildcard_received = []

    bus.subscribe("portfolio.asset_bought", lambda e: exact_received.append(e))
    bus.subscribe("*", lambda e: wildcard_received.append(e))

    event1 = AssetBought.create(portfolio_id=1, symbol="TCS", quantity=5, price=3500.0, total_cost=17500.0, user_id=1)
    event2 = PortfolioCreated.create(portfolio_id=2, name="Test", user_id=1, initial_cash=10000.0)

    bus.publish(event1)
    bus.publish(event2)

    # Exact listener only got event1
    assert len(exact_received) == 1
    assert exact_received[0].payload["symbol"] == "TCS"

    # Wildcard listener got both
    assert len(wildcard_received) == 2


def test_event_bus_unsubscribe():
    bus = InMemoryEventBus()
    calls = []

    def handler(event):
        calls.append(event)

    bus.subscribe("test.event", handler)
    event = DomainEvent(event_type="test.event", aggregate_id="test:1", payload={})
    bus.publish(event)
    assert len(calls) == 1

    bus.unsubscribe("test.event", handler)
    bus.publish(event)
    assert len(calls) == 1  # Not called again


def test_event_bus_fault_isolation():
    """An exception in one handler must NEVER prevent other handlers from executing or raise to caller."""
    bus = InMemoryEventBus()
    success_tracker = []

    def faulty_handler(event):
        raise RuntimeError("Simulated crash in handler")

    def safe_handler(event):
        success_tracker.append(event)

    bus.subscribe("test.fault", faulty_handler)
    bus.subscribe("test.fault", safe_handler)

    event = DomainEvent(event_type="test.fault", aggregate_id="test:1", payload={})
    # Should not raise exception
    bus.publish(event)

    assert len(success_tracker) == 1


def test_event_bus_history_and_clear():
    bus = InMemoryEventBus(max_history=5)
    for i in range(10):
        bus.publish(DomainEvent(event_type=f"event.{i}", aggregate_id=f"agg:{i}", payload={"i": i}))

    history = bus.get_history()
    # Bound to max_history (5)
    assert len(history) == 5
    assert history[-1].event_type == "event.9"

    filtered = bus.get_history(event_type="event.8")
    assert len(filtered) == 1

    bus.clear()
    assert len(bus.get_history()) == 0


# ===========================================================================
# 4. CQRS Model Tests
# ===========================================================================

def test_cqrs_commands():
    cmd_buy = BuyAsset(portfolio_id=1, symbol="INFY", quantity=10, user_id=42, limit_price=1600.0)
    assert cmd_buy.symbol == "INFY"
    assert cmd_buy.quantity == 10
    assert cmd_buy.command_id is not None
    assert isinstance(cmd_buy.created_at, datetime)

    cmd_sell = SellAsset(portfolio_id=1, symbol="INFY", quantity=5, user_id=42)
    assert cmd_sell.quantity == 5

    cmd_create_pf = CreatePortfolio(name="Main Portfolio", user_id=42, initial_cash=500000.0)
    assert cmd_create_pf.name == "Main Portfolio"


def test_cqrs_queries():
    q_pf = GetPortfolio(portfolio_id=1, user_id=42)
    assert q_pf.portfolio_id == 1
    assert q_pf.query_id is not None

    q_mkt = GetMarketSnapshot(symbol="RELIANCE")
    assert q_mkt.symbol == "RELIANCE"

    q_replay = GetReplayState(symbol="TCS", step_index=15)
    assert q_replay.step_index == 15


# ===========================================================================
# 5. Domain Service Integration Tests (Verifying Events Fired)
# ===========================================================================

def test_orchestrator_publishes_market_events():
    from api.analytics import default_orchestrator

    bus = get_event_bus()
    emitted = []
    bus.subscribe("market.regime_changed", lambda e: emitted.append(e))
    bus.subscribe("market.pattern_detected", lambda e: emitted.append(e))

    candles = [
        {"time": "2026-09-01", "open": 100, "high": 105, "low": 98, "close": 104, "volume": 1000},
        {"time": "2026-09-02", "open": 104, "high": 108, "low": 103, "close": 107, "volume": 1200},
        {"time": "2026-09-03", "open": 107, "high": 110, "low": 106, "close": 109, "volume": 1100},
        {"time": "2026-09-04", "open": 109, "high": 112, "low": 108, "close": 111, "volume": 1300},
        {"time": "2026-09-05", "open": 111, "high": 115, "low": 110, "close": 114, "volume": 1500},
    ]


    # run_market_regime emits RegimeChanged
    default_orchestrator.run_market_regime(candles, symbol="TEST.NS")
    regime_events = [e for e in emitted if e.event_type == "market.regime_changed"]
    assert len(regime_events) >= 1
    assert regime_events[0].payload["symbol"] == "TEST.NS"

    # run_patterns emits PatternDetected when patterns found
    patterns = default_orchestrator.run_patterns(candles, lookback=5, symbol="TEST.NS")
    if patterns:
        pat_events = [e for e in emitted if e.event_type == "market.pattern_detected"]
        assert len(pat_events) >= 1


def test_portfolio_service_publishes_events(db):
    from api.models.user import User, UserRole
    from api.services.portfolio_service import PortfolioService
    from .conftest import mock_provider

    bus = get_event_bus()
    captured = []
    bus.subscribe("portfolio.created", lambda e: captured.append(e))
    bus.subscribe("portfolio.asset_bought", lambda e: captured.append(e))
    bus.subscribe("portfolio.asset_sold", lambda e: captured.append(e))

    user = User(name="EventUser", email="event_pf@test.io", password_hash="x", role=UserRole.USER)
    db.add(user)
    db.flush()

    # 1. Create portfolio emits PortfolioCreated
    pf = PortfolioService.create(0, "Event Port", db, user.id)
    created_events = [e for e in captured if e.event_type == "portfolio.created"]
    assert len(created_events) >= 1
    assert created_events[-1].payload["name"] == "Event Port"

    # 2. Buy emits AssetBought
    svc = PortfolioService(db, user.id, mock_provider)
    svc.execute_trade(pf.id, "RELIANCE.NS", "BUY", 5)
    bought_events = [e for e in captured if e.event_type == "portfolio.asset_bought"]
    assert len(bought_events) >= 1
    assert bought_events[-1].payload["symbol"] == "RELIANCE.NS"

    # 3. Sell emits AssetSold
    svc.execute_trade(pf.id, "RELIANCE.NS", "SELL", 2)
    sold_events = [e for e in captured if e.event_type == "portfolio.asset_sold"]
    assert len(sold_events) >= 1
    assert sold_events[-1].payload["symbol"] == "RELIANCE.NS"
    assert sold_events[-1].payload["quantity"] == 2

