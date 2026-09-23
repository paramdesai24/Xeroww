"""API integration tests for the authenticated Replay Lab lifecycle."""

from datetime import date, timedelta

from api.core.dependencies import get_market_data_service
from api.main import app
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.tests.conftest import MockMarketProvider


class ReplayMarketProvider(MockMarketProvider):
    def get_ohlc(self, symbol: str, period: str = "1mo", interval: str = "1d"):
        start = date(2024, 1, 1)
        return [
            {
                "time": (start + timedelta(days=index)).isoformat(),
                "open": 100 + index,
                "high": 102 + index,
                "low": 99 + index,
                "close": 101 + index,
                "volume": 100_000 + index * 100,
            }
            for index in range(280)
        ]


def market_override():
    return MarketDataService(ReplayMarketProvider(), InMemoryCacheService())


def headers(client):
    response = client.post(
        "/auth/register",
        json={"name": "Replay User", "email": "replay-lab@example.com", "password": "StrongPass1!"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def plan(symbol, as_of):
    return {
        "symbol": symbol,
        "direction": "BULLISH",
        "intent": "WATCH",
        "holding_period": "SWING",
        "setup_type": "Replay structure",
        "confidence": 3,
        "thesis": "Visible structure supports continued observation.",
        "change_mind_condition": "Visible structure turns bearish.",
        "capital_base": 100000,
        "source_context": "REPLAY",
        "source_as_of": as_of,
        "source_period": "5y",
    }


def test_session_requires_decision_before_advancing(client):
    app.dependency_overrides[get_market_data_service] = market_override
    auth = headers(client)
    created = client.post(
        "/replay-sessions",
        headers=auth,
        json={
            "symbol": "RELIANCE.NS",
            "randomize_symbol": False,
            "randomize_start": False,
            "timeframe": "1d",
            "session_bars": 20,
            "starting_capital": 100000,
            "maximum_risk_pct": 1,
            "hide_symbol": False,
            "hide_calendar_date": True,
        },
    )
    assert created.status_code == 201, created.text
    state = created.json()
    started = client.post(
        f"/replay-sessions/{state['id']}/start",
        headers=auth,
        json={"expected_version": state["version"], "idempotency_key": "start-session-1"},
    )
    assert started.status_code == 200, started.text
    state = started.json()
    blocked = client.post(
        f"/replay-sessions/{state['id']}/advance",
        headers=auth,
        json={"expected_version": state["version"], "idempotency_key": "advance-blocked-1"},
    )
    assert blocked.status_code == 409
    preview = client.post(
        f"/replay-sessions/{state['id']}/decisions/preview",
        headers=auth,
        json=plan(state["symbol"], state["current_market_time"]),
    )
    assert preview.status_code == 200, preview.text
    preview_data = preview.json()
    decision = client.post(
        f"/replay-sessions/{state['id']}/decisions",
        headers=auth,
        json={
            **plan(state["symbol"], state["current_market_time"]),
            "expected_as_of": preview_data["resolved_as_of"],
            "supporting_evidence_keys": [],
            "conflicting_evidence_keys": [],
            "conflicts_reviewed": True,
        },
    )
    assert decision.status_code == 201, decision.text
    refreshed = client.get(f"/replay-sessions/{state['id']}", headers=auth).json()
    advanced = client.post(
        f"/replay-sessions/{state['id']}/advance",
        headers=auth,
        json={"expected_version": refreshed["version"], "idempotency_key": "advance-session-1"},
    )
    assert advanced.status_code == 200, advanced.text
    assert advanced.json()["visible_step"] == 1

