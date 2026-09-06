"""
api/core/exceptions.py
──────────────────────
Custom domain exception hierarchy for Xeroww platform.
All domain errors subclass XerowwException and provide structured error codes.
"""

from typing import Any


class XerowwException(Exception):
    """Base exception for all Xeroww domain errors."""
    code: str = "INTERNAL_ERROR"
    status_code: int = 500

    def __init__(
        self,
        message: str,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        result = {
            "code": self.code,
            "message": self.message,
        }
        if self.details:
            result["details"] = self.details
        return {"error": result}


class ResourceNotFoundError(XerowwException):
    code = "RESOURCE_NOT_FOUND"
    status_code = 404


class InsufficientDataError(XerowwException):
    code = "INSUFFICIENT_DATA"
    status_code = 422


class MarketDataUnavailableError(XerowwException):
    code = "MARKET_DATA_UNAVAILABLE"
    status_code = 503


class InvalidSymbolError(XerowwException):
    code = "INVALID_SYMBOL"
    status_code = 404


class UnauthorizedAccessError(XerowwException):
    code = "UNAUTHORIZED_ACCESS"
    status_code = 403


class RateLimitExceededError(XerowwException):
    code = "RATE_LIMIT_EXCEEDED"
    status_code = 429
