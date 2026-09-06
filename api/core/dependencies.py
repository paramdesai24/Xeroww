"""
core/dependencies.py
────────────────────
FastAPI dependency functions for Xeroww V0.6 authentication and authorization.

Usage in routes:
  # Require any authenticated user
  current_user: User = Depends(get_current_user)

  # Require a specific role
  current_user: User = Depends(require_role("ADMIN"))
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from api.database.session import get_db
from api.core.security import decode_token
from api.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required. Provide a valid Bearer token.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT Bearer token from the Authorization header.
    Returns the authenticated User ORM object.
    Raises 401 if token is missing, expired, or invalid.
    Raises 403 if account is deactivated.
    """
    if not credentials:
        raise _CREDENTIALS_EXC

    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired. Please refresh.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise _CREDENTIALS_EXC

    if payload.get("type") != "access":
        raise _CREDENTIALS_EXC

    user_id: int = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise _CREDENTIALS_EXC

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    return user


def require_role(role: str):
    """
    Dependency factory that enforces a minimum role.

    Usage:
      @router.get("/admin-only")
      def admin_endpoint(user: User = Depends(require_role("ADMIN"))):
          ...
    """
    def _check_role(current_user: User = Depends(get_current_user)) -> User:
        allowed_role = UserRole(role)
        if current_user.role != allowed_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {role}.",
            )
        return current_user

    return _check_role


# ---------------------------------------------------------------------------
# Market Provider & Market Data Service Dependencies
# ---------------------------------------------------------------------------
_default_provider = None
_default_market_service = None


def get_market_provider():
    """Return singleton or configured MarketDataProvider."""
    global _default_provider
    if _default_provider is None:
        from api.services.yahoo_provider import YahooFinanceProvider
        _default_provider = YahooFinanceProvider()
    return _default_provider


def get_market_data_service():
    """Return singleton or configured MarketDataService."""
    global _default_market_service
    if _default_market_service is None:
        from api.services.market_data_service import MarketDataService
        _default_market_service = MarketDataService(get_market_provider())
    return _default_market_service

