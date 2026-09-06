"""
tests/test_tenant_isolation.py
────────────────────────────────
Tests that verify strict tenant isolation:
  - User A cannot access User B's watchlists, portfolios, alerts, or journal.
  - All user-owned resources are scoped to user_id.

Emails use UUID suffixes to prevent collisions across the session-scoped DB engine.
"""

import pytest
import uuid


def _register_and_login(client, name: str = "Test") -> str:
    """Register with a guaranteed-unique email and return access token."""
    email = f"user_{uuid.uuid4().hex[:12]}@test.io"
    resp = client.post("/auth/register", json={
        "name": name, "email": email, "password": "SecurePass1"
    })
    assert resp.status_code == 201, f"Register failed: {resp.json()}"
    return resp.json()["access_token"]


class TestWatchlistIsolation:
    def test_user_cannot_access_other_watchlist(self, client):
        token_a = _register_and_login(client, "User A")
        token_b = _register_and_login(client, "User B")

        # User A creates a watchlist
        resp = client.post(
            "/watchlists",
            json={"name": "A's Private List"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp.status_code == 201
        wl_id = resp.json()["id"]

        # User B tries to access User A's watchlist — should 404
        resp = client.get(
            f"/watchlists/{wl_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404

    def test_user_cannot_delete_other_watchlist(self, client):
        token_a = _register_and_login(client, "User A")
        token_b = _register_and_login(client, "User B")

        # Create a non-default watchlist for User A
        resp = client.post(
            "/watchlists",
            json={"name": "A's List"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        wl_id = resp.json()["id"]

        # User B tries to delete it — should 404 (not 403 — no information leakage)
        resp = client.delete(
            f"/watchlists/{wl_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404

    def test_watchlist_list_is_scoped(self, client):
        token_a = _register_and_login(client, "Scope A")
        token_b = _register_and_login(client, "Scope B")

        # Each user has their own default watchlist from registration
        resp_a = client.get("/watchlists", headers={"Authorization": f"Bearer {token_a}"})
        resp_b = client.get("/watchlists", headers={"Authorization": f"Bearer {token_b}"})

        ids_a = {wl["id"] for wl in resp_a.json()}
        ids_b = {wl["id"] for wl in resp_b.json()}

        # No overlap between the two users' watchlists
        assert ids_a.isdisjoint(ids_b)


class TestPortfolioIsolation:
    def test_user_cannot_access_other_portfolio(self, client):
        token_a = _register_and_login(client, "Port A")
        token_b = _register_and_login(client, "Port B")

        # User A creates a portfolio
        resp = client.post(
            "/portfolios",
            json={"name": "A's Portfolio"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp.status_code == 201
        port_id = resp.json()["id"]

        # User B tries to access — should 404
        resp = client.get(
            f"/portfolios/{port_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404

    def test_portfolio_list_is_scoped(self, client):
        token_a = _register_and_login(client, "User AA")
        token_b = _register_and_login(client, "User BB")

        client.post("/portfolios", json={"name": "A Port"},
                    headers={"Authorization": f"Bearer {token_a}"})
        client.post("/portfolios", json={"name": "B Port"},
                    headers={"Authorization": f"Bearer {token_b}"})

        ports_a = client.get("/portfolios", headers={"Authorization": f"Bearer {token_a}"}).json()
        ports_b = client.get("/portfolios", headers={"Authorization": f"Bearer {token_b}"}).json()

        ids_a = {p["id"] for p in ports_a}
        ids_b = {p["id"] for p in ports_b}
        assert ids_a.isdisjoint(ids_b)


class TestAlertIsolation:
    def test_user_cannot_delete_other_alert(self, client):
        token_a = _register_and_login(client, "Alert A")
        token_b = _register_and_login(client, "Alert B")

        # User A creates an alert
        resp = client.post(
            "/alerts",
            json={
                "symbol": "RELIANCE.NS",
                "alert_type": "price_above",
                "condition_payload": {"threshold": 2500.0},
            },
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp.status_code == 201
        alert_id = resp.json()["id"]

        # User B tries to delete it — should 404
        resp = client.delete(
            f"/alerts/{alert_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404


class TestJournalIsolation:
    def test_journal_list_is_scoped(self, client):
        token_a = _register_and_login(client, "Journal A")
        token_b = _register_and_login(client, "Journal B")

        # User A posts a journal entry
        client.post(
            "/journal",
            json={
                "symbol": "TCS.NS",
                "action": "BUY",
                "thesis": "Strong support at 3800 with high institutional buying.",
            },
            headers={"Authorization": f"Bearer {token_a}"},
        )

        # User B's journal should be empty
        resp = client.get("/journal", headers={"Authorization": f"Bearer {token_b}"})
        assert resp.json() == []
