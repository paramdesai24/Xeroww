"""
core/security.py
────────────────
Authentication and cryptographic security utilities for Xeroww V0.6.

Provides:
  - bcrypt password hashing and verification
  - JWT access token and refresh token generation
  - Token decoding with error handling
  - Strong password validation rules
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from api.core.config import settings


# ---------------------------------------------------------------------------
# Password hashing — bcrypt
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt. Returns encoded hash string."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

PASSWORD_POLICY = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
)


def validate_password_strength(password: str) -> list[str]:
    """
    Validate password against Xeroww security policy.

    Returns a list of violation messages (empty if password is valid).
    Rules:
      - Minimum 8 characters
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one digit
    """
    errors: list[str] = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")
    return errors


# ---------------------------------------------------------------------------
# JWT token utilities
# ---------------------------------------------------------------------------

def _build_payload(
    subject: str | int,
    token_type: str,
    extra: dict[str, Any] | None = None,
    expire_delta: timedelta | None = None,
) -> dict[str, Any]:
    """Build a standard JWT payload dict."""
    now = datetime.now(tz=timezone.utc)
    expire = now + (expire_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": expire,
    }
    if extra:
        payload.update(extra)
    return payload


def create_access_token(user_id: int, role: str) -> str:
    """
    Create a short-lived JWT access token.

    Claims:
      sub  — user ID as string
      type — "access"
      role — UserRole value
    """
    payload = _build_payload(
        subject=user_id,
        token_type="access",
        extra={"role": role},
        expire_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """
    Create a long-lived JWT refresh token.

    Claims:
      sub  — user ID as string
      type — "refresh"
    """
    payload = _build_payload(
        subject=user_id,
        token_type="refresh",
        expire_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.

    Returns the decoded payload dict.
    Raises jwt.ExpiredSignatureError if expired.
    Raises jwt.InvalidTokenError for any other invalidity.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
