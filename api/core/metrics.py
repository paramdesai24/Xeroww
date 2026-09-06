"""
api/core/metrics.py
───────────────────
Prometheus application metrics instrumentation for Xeroww platform.
Collects throughput, latency, error rates, provider failures, and analytics duration.
No private user data or dynamic URL parameters are leaked into metrics labels.
"""

import time
import re
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

# ---------------------------------------------------------------------------
# Prometheus Metric Definitions
# ---------------------------------------------------------------------------

HTTP_REQUESTS_TOTAL = Counter(
    "xeroww_http_requests_total",
    "Total number of HTTP requests handled",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "xeroww_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

ACTIVE_CONNECTIONS = Gauge(
    "xeroww_active_connections",
    "Number of active concurrent client connections",
)

PROVIDER_FAILURES_TOTAL = Counter(
    "xeroww_provider_failures_total",
    "Total failures recorded across external market data providers",
    ["provider", "error_type"],
)

ANALYTICS_DURATION_SECONDS = Histogram(
    "xeroww_analytics_duration_seconds",
    "Deterministic analytics computation duration in seconds",
    ["engine"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)

CACHE_OPERATIONS_TOTAL = Counter(
    "xeroww_cache_operations_total",
    "Total cache access operations by cache type and status (hit/miss)",
    ["cache_name", "status"],
)


# Helper to normalize URL paths to prevent high-cardinality metric labels
# e.g., /quote/RELIANCE.NS -> /quote/:symbol
def normalize_metric_path(path: str) -> str:
    path = re.sub(r"/quote/[^/]+", "/quote/:symbol", path)
    path = re.sub(r"/ohlc/[^/]+", "/ohlc/:symbol", path)
    path = re.sub(r"/patterns/[^/]+", "/patterns/:symbol", path)
    path = re.sub(r"/support-resistance/[^/]+", "/support-resistance/:symbol", path)
    path = re.sub(r"/volume/[^/]+", "/volume/:symbol", path)
    path = re.sub(r"/moving-averages/[^/]+", "/moving-averages/:symbol", path)
    path = re.sub(r"/market-regime/[^/]+", "/market-regime/:symbol", path)
    path = re.sub(r"/signal-alignment/[^/]+", "/signal-alignment/:symbol", path)
    path = re.sub(r"/market-structure/[^/]+", "/market-structure/:symbol", path)
    path = re.sub(r"/portfolios/\d+", "/portfolios/:id", path)
    path = re.sub(r"/watchlists/\d+", "/watchlists/:id", path)
    path = re.sub(r"/alerts/\d+", "/alerts/:id", path)
    path = re.sub(r"/journal/\d+", "/journal/:id", path)
    path = re.sub(r"/annotations/\d+", "/annotations/:id", path)
    path = re.sub(r"/forensics/[^/]+", "/forensics/:symbol", path)
    path = re.sub(r"/diff/[^/]+", "/diff/:symbol", path)
    path = re.sub(r"/replay/timeline/[^/]+", "/replay/timeline/:symbol", path)
    return path


class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    """ASGI Middleware to measure request rate, error rate, and latency."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        endpoint = normalize_metric_path(request.url.path)
        method = request.method

        ACTIVE_CONNECTIONS.inc()
        start_time = time.perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start_time
            ACTIVE_CONNECTIONS.dec()
            HTTP_REQUESTS_TOTAL.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code),
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method,
                endpoint=endpoint,
            ).observe(duration)


def metrics_endpoint() -> Response:
    """FastAPI endpoint handler for GET /metrics."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
