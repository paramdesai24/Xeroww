from api.core.dependencies import get_market_data_service
from api.main import app
from api.services.cache_service import InMemoryCacheService
from api.services.market_data_service import MarketDataService
from api.tests.conftest import MockMarketProvider


def _headers(client, email="decision@example.com"):
    response = client.post("/auth/register", json={"name": "Decision User", "email": email, "password": "StrongPass1!"})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _plan():
    return {
        "symbol": "RELIANCE.NS",
        "direction": "BULLISH",
        "intent": "WATCH",
        "holding_period": "SWING",
        "setup_type": "Structure review",
        "confidence": 3,
        "thesis": "Price structure deserves observation before any entry.",
        "change_mind_condition": "Market structure becomes decisively bearish.",
        "source_context": "MARKET",
        "source_period": "1y",
    }


def _market_override():
    return MarketDataService(MockMarketProvider(), InMemoryCacheService())


def test_decision_preview_create_detail_and_status(client):
    app.dependency_overrides[get_market_data_service] = _market_override
    headers = _headers(client)
    preview = client.post("/decisions/preview", headers=headers, json=_plan())
    assert preview.status_code == 200, preview.text
    preview_data = preview.json()
    assert preview_data["resolved_as_of"] == "2026-01-20"
    assert preview_data["evidence"]["items"]

    payload = {
        **_plan(),
        "expected_as_of": preview_data["resolved_as_of"],
        "supporting_evidence_keys": [
            item["key"] for item in preview_data["evidence"]["items"] if item["relationship"] == "aligned"
        ],
        "conflicting_evidence_keys": [
            item["key"] for item in preview_data["evidence"]["items"] if item["relationship"] == "conflicting"
        ],
        "conflicts_reviewed": True,
    }
    created = client.post("/decisions", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    decision = created.json()
    assert decision["ticket_version"] == 1
    assert decision["snapshot_hash"] == preview_data["snapshot_hash"]

    listing = client.get("/decisions", headers=headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert "context_snapshot" not in listing.json()["items"][0]

    closed = client.post(
        f"/decisions/{decision['id']}/status",
        headers=headers,
        json={"status": "CLOSED", "reason": "Observation window completed.", "expected_version": 1},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "CLOSED"
    assert closed.json()["amendments"][0]["amendment_type"] == "STATUS_CHANGE"


def test_v09_ticket_rejects_legacy_mutation(client):
    app.dependency_overrides[get_market_data_service] = _market_override
    headers = _headers(client, "immutable@example.com")
    preview = client.post("/decisions/preview", headers=headers, json=_plan()).json()
    created = client.post("/decisions", headers=headers, json={
        **_plan(),
        "expected_as_of": preview["resolved_as_of"],
        "supporting_evidence_keys": [],
        "conflicting_evidence_keys": [],
        "conflicts_reviewed": True,
    }).json()
    response = client.patch(
        f"/journal/{created['id']}", headers=headers, json={"thesis": "Attempted rewrite of immutable history."}
    )
    assert response.status_code == 409


def test_replay_preview_excludes_future_candles(client):
    app.dependency_overrides[get_market_data_service] = _market_override
    headers = _headers(client, "replay-decision@example.com")
    payload = {**_plan(), "source_context": "REPLAY", "source_as_of": "2026-01-08", "source_period": "1y"}
    preview = client.post("/decisions/preview", headers=headers, json=payload)
    assert preview.status_code == 200, preview.text

    result = client.post("/decisions", headers=headers, json={
        **payload,
        "expected_as_of": "2026-01-08",
        "supporting_evidence_keys": [],
        "conflicting_evidence_keys": [],
        "conflicts_reviewed": True,
    })
    assert result.status_code == 201, result.text
    metadata = result.json()["context_snapshot"]["metadata"]
    assert metadata["resolved_as_of"] == "2026-01-08"
    assert metadata["bar_count"] == 8


def test_alert_source_is_preserved_in_decision(client):
    app.dependency_overrides[get_market_data_service] = _market_override
    headers = _headers(client, "alert-decision@example.com")
    payload = {**_plan(), "source_context": "ALERT", "setup_type": "Alert condition", "entry_trigger": "Above 2500"}
    preview = client.post("/decisions/preview", headers=headers, json=payload)
    assert preview.status_code == 200, preview.text
    created = client.post("/decisions", headers=headers, json={
        **payload,
        "expected_as_of": preview.json()["resolved_as_of"],
        "supporting_evidence_keys": [],
        "conflicting_evidence_keys": [],
        "conflicts_reviewed": True,
    })
    assert created.status_code == 201, created.text
    assert created.json()["source_context"] == "ALERT"
