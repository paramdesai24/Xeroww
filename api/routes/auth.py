"""
routes/auth.py
──────────────
Authentication routes for Xeroww V0.6.

Endpoints:
  POST /auth/register  — create new user account
  POST /auth/login     — exchange credentials for JWT tokens
  POST /auth/refresh   — exchange refresh token for new access token
  POST /auth/logout    — client-side token invalidation (stateless JWT)
  GET  /auth/me        — return current authenticated user profile
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import jwt

from api.database.session import get_db
from api.models.user import User, UserRole
from api.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    validate_password_strength,
)
from api.core.config import settings
from api.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)
from api.core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _make_tokens(user: User) -> TokenResponse:
    """Helper — build a full token response for a user."""
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new Xeroww user.
    Returns access and refresh tokens immediately after registration.
    """
    # Validate password strength
    errors = validate_password_strength(payload.password)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Password does not meet requirements.", "violations": errors},
        )

    # Check email uniqueness
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Seed a default watchlist for the new user
    _seed_default_watchlist(db, user)

    return _make_tokens(user)


@router.post("/login", response_model=TokenResponse, summary="Authenticate and receive JWT tokens")
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Exchange email + password for access and refresh tokens.
    Returns 401 for invalid credentials (no email enumeration).
    """
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    # Constant-time failure — don't reveal if email exists
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact support.",
        )

    return _make_tokens(user)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh an expired access token")
def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access token pair.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        data = decode_token(payload.refresh_token)
    except jwt.ExpiredSignatureError:
        raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    if data.get("type") != "refresh":
        raise credentials_exception

    user_id = int(data["sub"])
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise credentials_exception

    return _make_tokens(user)


from api.core.dependencies import get_current_user, bearer_scheme
from api.core.security import revoke_token
from fastapi.security import HTTPAuthorizationCredentials


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Logout and revoke current token")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
):
    """
    Logout endpoint — revokes the current access token via CacheService.
    Subsequent requests with this token are rejected with 401.
    """
    if credentials:
        revoke_token(credentials.credentials)
    return



@router.get("/me", response_model=UserResponse, summary="Get current authenticated user")
def me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _seed_default_watchlist(db: Session, user: User) -> None:
    """Create a default 'My Watchlist' for a newly registered user."""
    from api.models.watchlist import Watchlist, WatchlistItem
    watchlist = Watchlist(
        user_id=user.id,
        name="My Watchlist",
        is_default=True,
    )
    db.add(watchlist)
    db.flush()  # Get watchlist.id without committing

    default_symbols = settings.WATCHLIST_SYMBOLS
    for symbol in default_symbols:
        db.add(WatchlistItem(watchlist_id=watchlist.id, symbol=symbol))

    db.commit()
