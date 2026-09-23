"""Consistent API error envelopes for every request failure."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from api.core.exceptions import XerowwException
from api.core.tracing import get_current_trace_id

logger = logging.getLogger(__name__)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _response(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = get_current_trace_id()
    return JSONResponse(
        status_code=status_code,
        headers=headers,
        content={
            "detail": message,
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            },
            "timestamp": _timestamp(),
            "request_id": request_id,
        },
    )


def _field_name(location: tuple[Any, ...]) -> str:
    visible = [str(part) for part in location if part not in {"body", "path", "query"}]
    return ".".join(visible) or "request"


def _validation_message(error: dict[str, Any]) -> str:
    error_type = str(error.get("type", ""))
    context = error.get("ctx") or {}
    if error_type == "missing":
        return "This field is required."
    if error_type in {"int_parsing", "int_type"}:
        return "Enter a valid whole number."
    if error_type in {"float_parsing", "float_type"}:
        return "Enter a valid number."
    if error_type == "string_too_short":
        minimum = context.get("min_length")
        return f"Enter at least {minimum} character(s)." if minimum else "Enter a longer value."
    if error_type == "string_too_long":
        maximum = context.get("max_length")
        return f"Enter no more than {maximum} characters." if maximum else "Enter a shorter value."
    if error_type in {"greater_than", "greater_than_equal"}:
        return "Enter a value above the allowed minimum."
    if error_type == "string_pattern_mismatch":
        return "Choose one of the supported values."
    return "Check this value and try again."


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    fields = [
        {
            "field": _field_name(tuple(error.get("loc", ()))),
            "message": _validation_message(error),
        }
        for error in exc.errors()
    ]
    return _response(
        422,
        "VALIDATION_ERROR",
        "Check the highlighted fields and try again.",
        {"fields": fields},
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    messages = {
        400: "The request could not be completed.",
        401: "Your session is missing or has expired.",
        403: "You do not have access to this resource.",
        404: "The requested resource was not found.",
        409: "This change conflicts with the current state.",
        429: "Too many requests. Please wait and try again.",
    }
    codes = {
        400: "BAD_REQUEST",
        401: "AUTHENTICATION_REQUIRED",
        403: "FORBIDDEN",
        404: "RESOURCE_NOT_FOUND",
        409: "CONFLICT",
        429: "RATE_LIMIT_EXCEEDED",
    }
    message = exc.detail if isinstance(exc.detail, str) else messages.get(exc.status_code, "The request failed.")
    return _response(
        exc.status_code,
        codes.get(exc.status_code, "HTTP_ERROR"),
        message,
        headers=exc.headers,
    )


async def xeroww_exception_handler(request: Request, exc: XerowwException) -> JSONResponse:
    headers = {"Retry-After": "60"} if exc.status_code == 429 else None
    return _response(exc.status_code, exc.code, exc.message, exc.details, headers)


async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled request failure", exc_info=exc)
    return _response(
        500,
        "INTERNAL_ERROR",
        "Something went wrong. Please try again.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(XerowwException, xeroww_exception_handler)
    app.add_exception_handler(Exception, unexpected_exception_handler)
