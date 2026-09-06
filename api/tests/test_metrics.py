"""
api/tests/test_metrics.py
─────────────────────────
Tests for Prometheus metrics endpoint and request collection.
"""

from starlette.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_metrics_endpoint_returns_prometheus_format():
    # Trigger an endpoint
    res_stock = client.get("/stocks")
    assert res_stock.status_code == 200

    # Query metrics
    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    assert "text/plain" in res_metrics.headers["content-type"]
    text = res_metrics.text
    assert "xeroww_http_requests_total" in text
    assert "xeroww_http_request_duration_seconds" in text
    assert "xeroww_active_connections" in text
