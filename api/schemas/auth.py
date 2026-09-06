"""
schemas/auth.py
───────────────
Pydantic request/response schemas for the authentication domain.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Param Desai"])
    email: EmailStr = Field(..., examples=["param@xeroww.io"])
    password: str = Field(..., min_length=8, examples=["SecurePass1"])


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., examples=["param@xeroww.io"])
    password: str = Field(..., examples=["SecurePass1"])


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Long-lived refresh JWT")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
