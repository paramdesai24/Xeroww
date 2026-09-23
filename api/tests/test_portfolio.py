"""
tests/test_portfolio.py
────────────────────────
Tests for portfolio domain: create, BUY/SELL trades, WAC, P&L, validation.
Uses MockMarketProvider to avoid real Yahoo Finance calls.
"""

import pytest
from api.services.portfolio_service import PortfolioService
from api.models.portfolio import Holding, TradeSide
from .conftest import mock_provider


def _register_login(client, email: str) -> str:
    client.post("/auth/register", json={
        "name": "Portfolio User", "email": email, "password": "SecurePass1"
    })
    resp = client.post("/auth/login", json={"email": email, "password": "SecurePass1"})
    return resp.json()["access_token"]


class TestPortfolioService:
    """Unit tests for PortfolioService using in-memory DB and mock provider."""

    def test_create_portfolio(self, db):
        from api.models.user import User, UserRole
        user = User(name="T", email="port_svc@test.io",
                    password_hash="x", role=UserRole.USER)
        db.add(user)
        db.flush()
        portfolio = PortfolioService.create(0, "Test Portfolio", db, user.id)
        assert portfolio.name == "Test Portfolio"
        assert portfolio.cash_balance == 1_000_000.0

    def test_buy_deducts_cash(self, db):
        from api.models.user import User, UserRole
        user = User(name="T", email="buy_cash@test.io",
                    password_hash="x", role=UserRole.USER)
        db.add(user)
        db.flush()
        portfolio = PortfolioService.create(0, "Port", db, user.id)

        svc = PortfolioService(db, user.id, mock_provider)
        txn = svc.execute_trade(portfolio.id, "RELIANCE.NS", "BUY", 10)
        db.refresh(portfolio)

        expected_cost = 10 * 2500.0
        assert portfolio.cash_balance == pytest.approx(1_000_000.0 - expected_cost)
        assert txn.side == TradeSide.BUY
        assert txn.quantity == 10
        assert txn.execution_price == 2500.0

    def test_buy_creates_holding(self, db):
        from api.models.user import User, UserRole
        user = User(name="T", email="buy_hold@test.io",
                    password_hash="x", role=UserRole.USER)
        db.add(user)
        db.flush()
        portfolio = PortfolioService.create(0, "Port", db, user.id)

        svc = PortfolioService(db, user.id, mock_provider)
        svc.execute_trade(portfolio.id, "RELIANCE.NS", "BUY", 10)

        holding = db.query(Holding).filter(
            Holding.portfolio_id == portfolio.id,
            Holding.symbol == "RELIANCE.NS",
        ).first()
        assert holding is not None
        assert holding.quantity == 10
        assert holding.average_price == pytest.approx(2500.0)

    def test_weighted_average_cost_on_second_buy(self, db):
        from api.models.user import User, UserRole
        user = User(name="T", email="wac@test.io",
                    password_hash="x", role=UserRole.USER)
        db.add(user)
        db.flush()
        portfolio = PortfolioService.create(0, "Port", db, user.id)

        svc = PortfolioService(db, user.id, mock_provider)
        # Buy 10 at 2500 = cost 25000
        svc.execute_trade(portfolio.id, "RELIANCE.NS", "BUY", 10, limit_price=2500.0)
        # Buy 10 at 3000 = cost 30000 → WAC = (25000+30000)/20 = 2750
        svc.execute_trade(portfolio.id, "RELIANCE.NS", "BUY", 10, limit_price=3000.0)

        holding = db.query(Holding).filter(
            Holding.portfolio_id == portfolio.id,
            Holding.symbol == "RELIANCE.NS",
        ).first()
        assert holding.quantity == 20
        assert holding.average_price == pytest.approx(2750.0)

    def test_sell_reduces_holding(self, db):
        from api.models.user import User, UserRole
        user = User(name="T", email="sell_hold@test.io",
                    password_hash="x", role=UserRole.USER)
        db.add(user)
        db.flush()
        portfolio = PortfolioService.create(0, "Port", db, user.id)

        svc = PortfolioService(db, user.id, mock_provider)
        svc.execute_trade(portfolio.id, "RELIANCE.NS", "BUY", 20, limit_price=2500.0)
        txn = svc.execute_trade(portfolio.id, "RELIANCE.NS", "SELL", 8, limit_price=2600.0)

        holding = db.query(Holding).filter(
            Holding.portfolio_id == portfolio.id,
            Holding.symbol == "RELIANCE.NS",
        ).first()
        assert holding.quantity == 12
        # Realized P&L = (2600 - 2500) * 8 = 800
        assert txn.realized_pnl == pytest.approx(800.0)

    def test_sell_removes_holding_on_zero_qty(self, db):
        from api.models.user import User, UserRole
        user = User(name="T", email="sell_zero@test.io",
                    password_hash="x", role=UserRole.USER)
        db.add(user)
        db.flush()
        portfolio = PortfolioService.create(0, "Port", db, user.id)

        svc = PortfolioService(db, user.id, mock_provider)
        svc.execute_trade(portfolio.id, "TCS.NS", "BUY", 5, limit_price=3800.0)
        svc.execute_trade(portfolio.id, "TCS.NS", "SELL", 5, limit_price=4000.0)

        holding = db.query(Holding).filter(
            Holding.portfolio_id == portfolio.id,
            Holding.symbol == "TCS.NS",
        ).first()
        assert holding is None


class TestPortfolioValidation:
    def test_owner_can_rename_portfolio(self, client):
        token = _register_login(client, "rename_portfolio@test.io")
        headers = {"Authorization": f"Bearer {token}"}
        created = client.post("/portfolios", json={"name": "Original"}, headers=headers)

        response = client.patch(
            f"/portfolios/{created.json()['id']}",
            json={"name": "  Core Holdings  "},
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Core Holdings"

    def test_portfolio_rename_is_tenant_scoped(self, client):
        first = _register_login(client, "rename_owner@test.io")
        created = client.post("/portfolios", json={"name": "Private"}, headers={"Authorization": f"Bearer {first}"})
        second = _register_login(client, "rename_other@test.io")

        response = client.patch(
            f"/portfolios/{created.json()['id']}",
            json={"name": "Not Allowed"},
            headers={"Authorization": f"Bearer {second}"},
        )

        assert response.status_code == 404

    def test_blank_portfolio_name_is_rejected(self, client):
        token = _register_login(client, "blank_portfolio@test.io")
        response = client.post(
            "/portfolios",
            json={"name": "   "},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.parametrize("quantity", ["NaN", "Infinity", "-Infinity"])
    def test_non_finite_trade_quantity_is_rejected(self, client, quantity):
        token = _register_login(client, f"nonfinite_{quantity.lower().replace('-', 'neg')}@test.io")
        headers = {"Authorization": f"Bearer {token}"}
        created = client.post("/portfolios", json={"name": "Finite"}, headers=headers)

        response = client.post(
            f"/portfolios/{created.json()['id']}/trade",
            json={"symbol": "RELIANCE.NS", "side": "BUY", "quantity": quantity},
            headers=headers,
        )

        assert response.status_code == 422

    def test_buy_insufficient_cash_rejected(self, client):
        token = _register_login(client, "insuf_cash@test.io")
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post("/portfolios", json={"name": "Test"}, headers=headers)
        port_id = resp.json()["id"]

        # Try to buy 100,000 shares at any price > 10
        resp = client.post(f"/portfolios/{port_id}/trade", json={
            "symbol": "RELIANCE.NS",
            "side": "BUY",
            "quantity": 1_000_000,
            "limit_price": 2500.0,
        }, headers=headers)
        assert resp.status_code == 400
        assert "Insufficient cash" in resp.json()["detail"]

    def test_sell_without_holding_rejected(self, client):
        token = _register_login(client, "no_hold@test.io")
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post("/portfolios", json={"name": "Test"}, headers=headers)
        port_id = resp.json()["id"]

        resp = client.post(f"/portfolios/{port_id}/trade", json={
            "symbol": "RELIANCE.NS",
            "side": "SELL",
            "quantity": 5,
            "limit_price": 2500.0,
        }, headers=headers)
        assert resp.status_code == 400
        assert "No holding" in resp.json()["detail"]

    def test_sell_excess_quantity_rejected(self, client):
        token = _register_login(client, "excess_sell@test.io")
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post("/portfolios", json={"name": "Test"}, headers=headers)
        port_id = resp.json()["id"]

        # Buy 10
        client.post(f"/portfolios/{port_id}/trade", json={
            "symbol": "INFY.NS", "side": "BUY",
            "quantity": 10, "limit_price": 1600.0
        }, headers=headers)

        # Try to sell 20
        resp = client.post(f"/portfolios/{port_id}/trade", json={
            "symbol": "INFY.NS", "side": "SELL",
            "quantity": 20, "limit_price": 1700.0
        }, headers=headers)
        assert resp.status_code == 400
        assert "Cannot sell" in resp.json()["detail"]

    def test_invalid_side_rejected(self, client):
        token = _register_login(client, "inv_side@test.io")
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.post("/portfolios", json={"name": "Test"}, headers=headers)
        port_id = resp.json()["id"]

        resp = client.post(f"/portfolios/{port_id}/trade", json={
            "symbol": "TCS.NS", "side": "HOLD", "quantity": 1
        }, headers=headers)
        assert resp.status_code == 422
