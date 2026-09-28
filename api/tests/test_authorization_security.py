"""
api/tests/test_authorization_security.py
────────────────────────────────────────
Explicit multi-tenant authorization security tests.
Verifies that User A cannot read, update, or delete User B's resources
by swapping IDs in URL paths, and verifies token revocation upon logout.
"""

import pytest
from uuid import uuid4
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from api.main import app
from api.database.session import SessionLocal
from api.models.user import User, UserRole
from api.core.security import hash_password, create_access_token
from api.models.portfolio import Portfolio
from api.models.watchlist import Watchlist
from api.models.alert import Alert, AlertType
from api.models.intelligence import DecisionJournalEntry, JournalStatus, ChartAnnotation, AnnotationType

client = TestClient(app)


@pytest.fixture
def test_users_and_resources():
    db: Session = SessionLocal()
    run_id = uuid4().hex

    # User A
    user_a = User(
        name="User A",
        email=f"user_a_{run_id}@xeroww.test",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
    )
    # User B
    user_b = User(
        name="User B",
        email=f"user_b_{run_id}@xeroww.test",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    # Resources belonging to User B
    portfolio_b = Portfolio(user_id=user_b.id, name="User B Portfolio", cash_balance=50000.0)
    watchlist_b = Watchlist(user_id=user_b.id, name="User B Watchlist", is_default=False)
    alert_b = Alert(
        user_id=user_b.id,
        symbol="TCS.NS",
        alert_type=AlertType.PRICE_ABOVE,
        condition_payload={"threshold": 4000.0},
    )
    journal_b = DecisionJournalEntry(
        user_id=user_b.id,
        symbol="INFY.NS",
        action="BUY",
        thesis="User B Secret Trade Thesis",
        status=JournalStatus.OPEN,
    )
    annotation_b = ChartAnnotation(
        user_id=user_b.id,
        symbol="RELIANCE.NS",
        annotation_type=AnnotationType.NOTE,
        content="User B Private Observation",
    )
    db.add_all([portfolio_b, watchlist_b, alert_b, journal_b, annotation_b])
    db.commit()
    db.refresh(portfolio_b)
    db.refresh(watchlist_b)
    db.refresh(alert_b)
    db.refresh(journal_b)
    db.refresh(annotation_b)

    token_a = create_access_token(user_a.id, "USER")
    token_b = create_access_token(user_b.id, "USER")

    data = {
        "user_a": user_a,
        "user_b": user_b,
        "token_a": token_a,
        "token_b": token_b,
        "portfolio_b_id": portfolio_b.id,
        "watchlist_b_id": watchlist_b.id,
        "alert_b_id": alert_b.id,
        "journal_b_id": journal_b.id,
        "annotation_b_id": annotation_b.id,
    }

    yield data

    # Cleanup
    db.query(ChartAnnotation).filter(ChartAnnotation.user_id.in_([user_a.id, user_b.id])).delete()
    db.query(DecisionJournalEntry).filter(DecisionJournalEntry.user_id.in_([user_a.id, user_b.id])).delete()
    db.query(Alert).filter(Alert.user_id.in_([user_a.id, user_b.id])).delete()
    db.query(Watchlist).filter(Watchlist.user_id.in_([user_a.id, user_b.id])).delete()
    db.query(Portfolio).filter(Portfolio.user_id.in_([user_a.id, user_b.id])).delete()
    db.query(User).filter(User.id.in_([user_a.id, user_b.id])).delete()
    db.commit()
    db.close()


def test_user_a_cannot_access_user_b_portfolio(test_users_and_resources):
    res = client.get(
        f"/portfolios/{test_users_and_resources['portfolio_b_id']}",
        headers={"Authorization": f"Bearer {test_users_and_resources['token_a']}"},
    )
    assert res.status_code in [403, 404]


def test_user_a_cannot_trade_on_user_b_portfolio(test_users_and_resources):
    res = client.post(
        f"/portfolios/{test_users_and_resources['portfolio_b_id']}/trade",
        headers={"Authorization": f"Bearer {test_users_and_resources['token_a']}"},
        json={"symbol": "TCS.NS", "side": "BUY", "quantity": 10, "price": 3500.0},
    )
    assert res.status_code in [403, 404]


def test_user_a_cannot_delete_user_b_watchlist(test_users_and_resources):
    res = client.delete(
        f"/watchlists/{test_users_and_resources['watchlist_b_id']}",
        headers={"Authorization": f"Bearer {test_users_and_resources['token_a']}"},
    )
    assert res.status_code in [403, 404]


def test_user_a_cannot_delete_user_b_alert(test_users_and_resources):
    res = client.delete(
        f"/alerts/{test_users_and_resources['alert_b_id']}",
        headers={"Authorization": f"Bearer {test_users_and_resources['token_a']}"},
    )
    assert res.status_code in [403, 404]


def test_user_a_cannot_access_user_b_journal_entry(test_users_and_resources):
    res = client.get(
        f"/journal/{test_users_and_resources['journal_b_id']}",
        headers={"Authorization": f"Bearer {test_users_and_resources['token_a']}"},
    )
    assert res.status_code in [403, 404]


def test_user_a_cannot_delete_user_b_annotation(test_users_and_resources):
    res = client.delete(
        f"/annotations/{test_users_and_resources['annotation_b_id']}",
        headers={"Authorization": f"Bearer {test_users_and_resources['token_a']}"},
    )
    assert res.status_code in [403, 404]


def test_logout_revokes_token(test_users_and_resources):
    token = test_users_and_resources["token_a"]

    # Verify token works before logout
    res_before = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_before.status_code == 200

    # Logout
    res_logout = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert res_logout.status_code == 204

    # Verify token is rejected after logout
    res_after = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_after.status_code == 401
    assert "revoked" in res_after.json()["detail"].lower()
