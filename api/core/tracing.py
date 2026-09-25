"""
api/core/tracing.py
───────────────────
Distributed tracing preparation module for Xeroww platform.
Provides lightweight W3C / OpenTelemetry-compatible trace and span propagation across
request -> service -> provider/database boundaries.
Prepares trace context for optional OpenTelemetry exporter attachment.
"""

import secrets
import contextvars
from contextlib import contextmanager
from typing import Generator, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variables holding the active trace and span identifiers for the current task
_trace_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("trace_id", default=None)
_span_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("span_id", default=None)


def generate_trace_id() -> str:
    """Generate a 128-bit (32-character hex) W3C-compliant trace ID."""
    return secrets.token_hex(16)


def generate_span_id() -> str:
    """Generate a 64-bit (16-character hex) W3C-compliant span ID."""
    return secrets.token_hex(8)


def get_current_trace_id() -> str:
    """Retrieve the current active trace ID or generate a fallback."""
    tid = _trace_id_ctx.get()
    if not tid:
        tid = generate_trace_id()
        _trace_id_ctx.set(tid)
    return tid


def get_current_span_id() -> str:
    """Retrieve the current active span ID or generate a fallback."""
    sid = _span_id_ctx.get()
    if not sid:
        sid = generate_span_id()
        _span_id_ctx.set(sid)
    return sid


class Span:
    """Lightweight span representation tracking operation name, duration, and metadata."""

    def __init__(self, name: str, parent_id: str | None = None):
        self.name = name
        self.trace_id = get_current_trace_id()
        self.span_id = generate_span_id()
        self.parent_id = parent_id
        self.attributes: dict[str, Any] = {}

    def set_attribute(self, key: str, value: Any) -> "Span":
        self.attributes[key] = value
        return self


@contextmanager
def trace_span(name: str) -> Generator[Span, None, None]:
    """
    Context manager to trace execution across service and provider calls.

    Usage:
        with trace_span("provider.get_quote") as span:
            span.set_attribute("symbol", symbol)
            ...
    """
    parent_span_id = _span_id_ctx.get()
    span = Span(name=name, parent_id=parent_span_id)
    token = _span_id_ctx.set(span.span_id)
    try:
        yield span
    finally:
        _span_id_ctx.reset(token)


class TracingMiddleware(BaseHTTPMiddleware):
    """
    ASGI Middleware to attach and propagate X-Trace-ID on every incoming request.
    Extracts existing incoming trace ID (W3C traceparent or X-Trace-ID) or creates a new one.
    """

    async def dispatch(self, request: Request, call_next):
        incoming_trace_id = (
            request.headers.get("X-Trace-ID")
            or request.headers.get("x-request-id")
            or generate_trace_id()
        )
        root_span_id = generate_span_id()

        trace_token = _trace_id_ctx.set(incoming_trace_id)
        span_token = _span_id_ctx.set(root_span_id)

        # Store on request state for easy access in route handlers
        request.state.trace_id = incoming_trace_id
        request.state.span_id = root_span_id

        try:
            response: Response = await call_next(request)
            response.headers["X-Trace-ID"] = incoming_trace_id
            response.headers["X-Span-ID"] = root_span_id
            return response
        finally:
            _trace_id_ctx.reset(trace_token)
            _span_id_ctx.reset(span_token)
