"""
api/schemas/common.py
─────────────────────
Common Pydantic schemas for standardized pagination, resource metadata, and errors.
"""

from typing import Generic, TypeVar, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class StandardErrorResponse(BaseModel):
    error: ErrorDetail


class PaginationParams(BaseModel):
    skip: int = Field(default=0, ge=0, description="Offset items count")
    limit: int = Field(default=50, ge=1, le=100, description="Max items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    skip: int
    limit: int
