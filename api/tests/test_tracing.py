"""
api/tests/test_tracing.py
─────────────────────────
Tests for distributed tracing preparation and trace propagation.
"""

from starlette.testclient import TestClient
from api.main import app
from api.core.tracing import trace_span

client = TestClient(app)


def test_response_includes_trace_headers():
    res = client.get("/health")
    assert res.status_code == 200
    assert "X-Trace-ID" in res.headers
    assert "X-Span-ID" in res.headers
    assert len(res.headers["X-Trace-ID"]) >= 16


def test_incoming_trace_id_propagated():
    custom_trace = "0123456789abcdef0123456789abcdef"
    res = client.get("/health", headers={"X-Trace-ID": custom_trace})
    assert res.status_code == 200
    assert res.headers["X-Trace-ID"] == custom_trace


def test_internal_span_context():
    with trace_span("database.query") as span:
        span.set_attribute("table", "users")
        assert span.name == "database.query"
        assert span.attributes["table"] == "users"
        assert len(span.span_id) == 16
        assert len(span.trace_id) >= 16
