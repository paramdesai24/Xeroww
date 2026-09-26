"""
tests/test_alert_evaluator.py
──────────────────────────────
Tests for the alert evaluation engine.
Uses MockMarketProvider to avoid real Yahoo Finance calls.
"""

from api.services.alert_evaluator import StandardAlertEvaluator
from api.models.alert import Alert, AlertType
from api.tests.conftest import mock_provider


def _make_alert(alert_type: str, symbol: str, payload: dict) -> Alert:
    """Create an Alert ORM object without DB."""
    alert = Alert()
    alert.id = 1
    alert.user_id = 1
    alert.symbol = symbol
    alert.alert_type = AlertType(alert_type)
    alert.condition_payload = payload
    alert.enabled = True
    alert.triggered_at = None
    return alert


class TestPriceAbove:
    def test_triggers_when_price_above_threshold(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("price_above", "RELIANCE.NS", {"threshold": 2000.0})
        result = evaluator.evaluate(alert)
        # RELIANCE.NS mock price is 2500 > 2000 → triggered
        assert result.triggered is True
        assert result.current_value == 2500.0

    def test_does_not_trigger_below_threshold(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("price_above", "RELIANCE.NS", {"threshold": 3000.0})
        result = evaluator.evaluate(alert)
        # 2500 < 3000 → not triggered
        assert result.triggered is False


class TestPriceBelow:
    def test_triggers_when_price_below_threshold(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("price_below", "TCS.NS", {"threshold": 4000.0})
        result = evaluator.evaluate(alert)
        # TCS.NS mock price is 3800 < 4000 → triggered
        assert result.triggered is True

    def test_does_not_trigger_above_threshold(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("price_below", "TCS.NS", {"threshold": 3000.0})
        result = evaluator.evaluate(alert)
        # 3800 > 3000 → not triggered
        assert result.triggered is False


class TestPercentageMove:
    def test_triggers_on_upward_move(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        # Reference 2000, current 2500 → +25% move, target 5% up → triggered
        alert = _make_alert("percentage_move", "RELIANCE.NS", {
            "pct": 5.0, "direction": "up", "reference_price": 2000.0
        })
        result = evaluator.evaluate(alert)
        assert result.triggered is True

    def test_does_not_trigger_on_insufficient_move(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        # Reference 2490, current 2500 → +0.4%, target 5% → not triggered
        alert = _make_alert("percentage_move", "RELIANCE.NS", {
            "pct": 5.0, "direction": "up", "reference_price": 2490.0
        })
        result = evaluator.evaluate(alert)
        assert result.triggered is False

    def test_invalid_reference_price_returns_safe_result(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("percentage_move", "RELIANCE.NS", {
            "pct": 5.0, "direction": "up", "reference_price": 0.0
        })
        result = evaluator.evaluate(alert)
        assert result.triggered is False
        assert "Invalid reference_price" in result.message


class TestAlertValidation:
    def test_unsupported_alert_type_handled_gracefully(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("price_above", "RELIANCE.NS", {"threshold": 100.0})
        # Manually set an invalid type string (bypass enum)
        alert.alert_type = "completely_invalid_type"
        result = evaluator.evaluate(alert)
        assert result.triggered is False
        assert "Unsupported" in result.message

    def test_evaluation_result_has_required_fields(self):
        evaluator = StandardAlertEvaluator(mock_provider)
        alert = _make_alert("price_above", "INFY.NS", {"threshold": 1000.0})
        result = evaluator.evaluate(alert)
        assert hasattr(result, "alert_id")
        assert hasattr(result, "triggered")
        assert hasattr(result, "message")
        assert hasattr(result, "condition_payload")
        assert isinstance(result.triggered, bool)


class TestAlertAPI:
    def _login(self, client, email):
        client.post("/auth/register", json={
            "name": "Alert User", "email": email, "password": "SecurePass1"
        })
        resp = client.post("/auth/login", json={"email": email, "password": "SecurePass1"})
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    def test_create_alert(self, client):
        headers = self._login(client, "alert_create@test.io")
        resp = client.post("/alerts", json={
            "symbol": "RELIANCE.NS",
            "alert_type": "price_above",
            "condition_payload": {"threshold": 2500.0},
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["alert_type"] == "price_above"
        assert data["enabled"] is True

    def test_typed_condition_validation_and_pause(self, client):
        owner = self._login(client, "alert_patch_owner@test.io")
        other = self._login(client, "alert_patch_other@test.io")
        invalid = client.post("/alerts", json={
            "symbol": "RELIANCE.NS", "alert_type": "price_above",
            "condition_payload": {"threshold": -1},
        }, headers=owner)
        assert invalid.status_code == 422
        assert "condition_payload" in str(invalid.json())
        invalid_symbol = client.post("/alerts", json={
            "symbol": "NOTLISTED.NS", "alert_type": "price_above",
            "condition_payload": {"threshold": 100},
        }, headers=owner)
        assert invalid_symbol.status_code == 422
        created = client.post("/alerts", json={
            "symbol": "RELIANCE.NS", "alert_type": "price_above",
            "condition_payload": {"threshold": 100},
        }, headers=owner).json()
        url = f"/alerts/{created['id']}"
        assert client.patch(url, json={"enabled": False}, headers=other).status_code == 404
        paused = client.patch(url, json={"enabled": False}, headers=owner)
        assert paused.status_code == 200
        assert paused.json()["enabled"] is False
        assert client.post(f"{url}/evaluate", headers=owner).status_code == 409
        resumed = client.patch(url, json={"enabled": True}, headers=owner)
        assert resumed.json()["enabled"] is True
        assert client.patch(url, json={"condition_payload": {"threshold": 150}}, headers=owner).json()["condition_payload"]["threshold"] == 150

    def test_invalid_alert_type_rejected(self, client):
        headers = self._login(client, "alert_invalid@test.io")
        resp = client.post("/alerts", json={
            "symbol": "RELIANCE.NS",
            "alert_type": "fake_type",
            "condition_payload": {},
        }, headers=headers)
        assert resp.status_code == 422

    def test_list_alerts_is_scoped(self, client):
        headers = self._login(client, "alert_scoped@test.io")
        resp = client.get("/alerts", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_evaluation_history_survives_list_refresh_and_is_tenant_scoped(self, client):
        owner = self._login(client, "alert_history_owner@test.io")
        other = self._login(client, "alert_history_other@test.io")
        created = client.post("/alerts", json={
            "symbol": "RELIANCE.NS", "alert_type": "price_above",
            "condition_payload": {"threshold": 2000},
        }, headers=owner).json()
        checked = client.post(f"/alerts/{created['id']}/evaluate", headers=owner)
        assert checked.status_code == 200
        assert checked.json()["triggered"] is True
        assert checked.json()["evaluation_id"] is not None

        listed = client.get("/alerts", headers=owner).json()
        assert listed[0]["latest_evaluation"]["triggered"] is True
        history = client.get(f"/alerts/{created['id']}/evaluations", headers=owner)
        assert history.status_code == 200
        assert len(history.json()) == 1
        assert history.json()[0]["observed_value"] == 2500.0
        assert client.get(f"/alerts/{created['id']}/evaluations", headers=other).status_code == 404

    def test_evaluate_all_preserves_success_when_one_provider_call_fails(self, client, monkeypatch):
        owner = self._login(client, "alert_partial@test.io")
        for symbol in ("RELIANCE.NS", "TCS.NS"):
            response = client.post("/alerts", json={
                "symbol": symbol, "alert_type": "price_above",
                "condition_payload": {"threshold": 2000},
            }, headers=owner)
            assert response.status_code == 201

        original = StandardAlertEvaluator.evaluate
        def evaluate_with_failure(self, alert):
            if alert.symbol == "TCS.NS":
                raise RuntimeError("private provider diagnostic")
            return original(self, alert)

        monkeypatch.setattr(StandardAlertEvaluator, "evaluate", evaluate_with_failure)
        response = client.post("/alerts/evaluate-all", headers=owner)
        assert response.status_code == 200
        results = {row["symbol"]: row for row in response.json()}
        assert results["RELIANCE.NS"]["triggered"] is True
        assert results["TCS.NS"]["data_quality_status"] == "error"
        assert "private provider diagnostic" not in results["TCS.NS"]["message"]
        listed = client.get("/alerts", headers=owner).json()
        assert all(row["latest_evaluation"] is not None for row in listed)
