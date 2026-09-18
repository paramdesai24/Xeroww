# ADR 0006: Observability, Metrics and Distributed Tracing Architecture

## Status
Accepted

## Context
Operating a financial analytics platform in high-load production requires deep visibility into system latency, upstream provider reliability, cache hit ratios, error rates, and request journeys across service layers. Post-incident log grepping is insufficient for diagnosing intermittent market data latency or micro-outages.

## Decision
We establish a native three-pillar observability foundation:
1. Metrics: Standardized Prometheus metric instrumentation (`api/core/metrics.py`) exposing `/metrics` with counters, gauges, and histograms covering HTTP requests, latencies, provider query durations, and cache hit/miss distributions.
2. Tracing context: lightweight OpenTelemetry-compatible identifier propagation in `api/core/tracing.py`. It generates `X-Trace-ID` and `X-Span-ID` headers and provides a `trace_span()` context manager. It does not currently export spans to an OpenTelemetry collector.
3. Visualization: Automated Grafana provisioning with pre-configured operational dashboards (`grafana/dashboards/xeroww_overview.json`) displaying golden signals (Traffic, Latency, Error Rate, Cache Efficiency).

## Consequences
### Positive
- Direct out-of-the-box monitoring in Docker Compose with zero manual configuration.
- Trace IDs propagated back to HTTP clients via response headers for end-to-end debugging.
- Immediate insight into upstream provider degradations or cache invalidation anomalies.

### Negative
- Additional CPU and memory overhead for metric collection and request wrapping. No repository benchmark currently quantifies that overhead.
