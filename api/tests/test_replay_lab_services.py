"""Focused tests for persisted replay state and deterministic scoring."""

from copy import deepcopy
from types import SimpleNamespace

from api.services.replay_scoring_service import ReplayScoringService
from api.services.replay_session_state_service import ReplaySessionStateService


def candles(count=260):
    return [
        {
            "time": f"2025-{1 + index // 28:02d}-{1 + index % 28:02d}",
            "open": 100 + index,
            "high": 102 + index,
            "low": 99 + index,
            "close": 101 + index,
            "volume": 100_000 + index * 100,
        }
        for index in range(count)
    ]


def replay_session(dataset):
    return SimpleNamespace(
        id=9,
        status="ACTIVE",
        symbol="TEST.NS",
        hide_symbol=False,
        hide_calendar_date=False,
        timeframe="1d",
        setup_category="Pullback",
        starting_capital=100000,
        current_cash=100000,
        maximum_risk_pct=1,
        start_index=220,
        current_index=225,
        end_index=239,
        warmup_start_index=20,
        current_market_time="2025-09-02T00:00:00",
        version=3,
        dataset_payload=dataset,
        dataset_fingerprint="abc",
    )


def test_visible_state_is_not_changed_by_future_data():
    original = candles()
    tampered = deepcopy(original)
    tampered[230]["close"] = 999999
    normal_state = ReplaySessionStateService.build(
        replay_session(original), active_decision_id=None, position={"is_open": False}
    )
    tampered_state = ReplaySessionStateService.build(
        replay_session(tampered), active_decision_id=None, position={"is_open": False}
    )
    assert normal_state["candles"] == tampered_state["candles"]
    assert normal_state["analytics"] == tampered_state["analytics"]
    assert normal_state["provenance"]["future_values_exposed"] is False


def test_process_score_is_independent_of_profitable_outcome():
    session = SimpleNamespace(id=1, dataset_payload=candles(10), current_index=5)
    decision = SimpleNamespace(
        thesis="A documented thesis",
        change_mind_condition="A documented invalidation",
        conflicting_evidence_keys=[],
        risk_snapshot={"complete": True, "recommended_quantity": 2},
        snapshot_hash="hash",
        invalidation_price=90,
    )
    events = [SimpleNamespace(id=1, event_type="DECISION_SUBMITTED", payload={})]
    score = ReplayScoringService.calculate(session, decision, events, [])
    assert score["process_score"] == 95
    assert score["outcome_metrics"]["applicable"] is False
