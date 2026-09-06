"""
tests/test_auth.py
──────────────────
Tests for authentication: password hashing, registration, login, JWT, roles.
"""

import pytest
from api.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    validate_password_strength,
)
from api.models.user import User, UserRole
from api.database.session import Base


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

class TestPasswordHashing:
    def test_hash_is_not_plain(self):
        h = hash_password("SecurePass1")
        assert h != "SecurePass1"
        assert len(h) > 0

    def test_verify_correct_password(self):
        h = hash_password("MyPass123")
        assert verify_password("MyPass123", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("MyPass123")
        assert verify_password("WrongPass1", h) is False

    def test_two_hashes_are_different(self):
        """bcrypt salts should produce unique hashes."""
        h1 = hash_password("SamePass1")
        h2 = hash_password("SamePass1")
        assert h1 != h2


# ---------------------------------------------------------------------------
# Password policy
# ---------------------------------------------------------------------------

class TestPasswordPolicy:
    def test_valid_password(self):
        errors = validate_password_strength("Secure123")
        assert errors == []

    def test_too_short(self):
        errors = validate_password_strength("Ab1")
        assert any("8 characters" in e for e in errors)

    def test_no_uppercase(self):
        errors = validate_password_strength("lowercase1")
        assert any("uppercase" in e for e in errors)

    def test_no_lowercase(self):
        errors = validate_password_strength("UPPERCASE1")
        assert any("lowercase" in e for e in errors)

    def test_no_digit(self):
        errors = validate_password_strength("NoDigitsHere")
        assert any("digit" in e for e in errors)

    def test_multiple_violations(self):
        errors = validate_password_strength("abc")
        assert len(errors) >= 2


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

class TestJWT:
    def test_access_token_decode(self):
        token = create_access_token(user_id=42, role="USER")
        payload = decode_token(token)
        assert payload["sub"] == "42"
        assert payload["type"] == "access"
        assert payload["role"] == "USER"

    def test_refresh_token_decode(self):
        token = create_refresh_token(user_id=7)
        payload = decode_token(token)
        assert payload["sub"] == "7"
        assert payload["type"] == "refresh"

    def test_invalid_token_raises(self):
        import jwt
        with pytest.raises(jwt.InvalidTokenError):
            decode_token("not.a.valid.token")

    def test_access_and_refresh_are_different(self):
        access = create_access_token(1, "USER")
        refresh = create_refresh_token(1)
        assert access != refresh


# ---------------------------------------------------------------------------
# Registration and login via HTTP
# ---------------------------------------------------------------------------

class TestRegistration:
    def test_register_success(self, client):
        resp = client.post("/auth/register", json={
            "name": "Test User",
            "email": "test@xeroww.io",
            "password": "SecurePass1",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client):
        payload = {"name": "U1", "email": "dup@xeroww.io", "password": "SecurePass1"}
        client.post("/auth/register", json=payload)
        resp = client.post("/auth/register", json=payload)
        assert resp.status_code == 409

    def test_register_weak_password(self, client):
        resp = client.post("/auth/register", json={
            "name": "Weak", "email": "weak@xeroww.io", "password": "weak"
        })
        assert resp.status_code == 422

    def test_register_invalid_email(self, client):
        resp = client.post("/auth/register", json={
            "name": "Bad", "email": "not-an-email", "password": "SecurePass1"
        })
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client):
        client.post("/auth/register", json={
            "name": "Login Test", "email": "login@xeroww.io", "password": "SecurePass1"
        })
        resp = client.post("/auth/login", json={
            "email": "login@xeroww.io", "password": "SecurePass1"
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password(self, client):
        client.post("/auth/register", json={
            "name": "LP", "email": "lp@xeroww.io", "password": "SecurePass1"
        })
        resp = client.post("/auth/login", json={
            "email": "lp@xeroww.io", "password": "WrongPass9"
        })
        assert resp.status_code == 401

    def test_login_unknown_email(self, client):
        resp = client.post("/auth/login", json={
            "email": "nobody@xeroww.io", "password": "SecurePass1"
        })
        assert resp.status_code == 401


class TestProtectedEndpoints:
    def test_me_requires_auth(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_returns_user(self, client):
        client.post("/auth/register", json={
            "name": "Me User", "email": "me@xeroww.io", "password": "SecurePass1"
        })
        login = client.post("/auth/login", json={
            "email": "me@xeroww.io", "password": "SecurePass1"
        })
        token = login.json()["access_token"]
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@xeroww.io"
        assert resp.json()["role"] == "USER"

    def test_invalid_token_rejected(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401
