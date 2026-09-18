# ADR 0005: Multi-Tiered Market Data Caching Strategy

## Status
Accepted

## Context
Upstream market data providers enforce rate limits and introduce variable network latency. Downstream clients repeatedly request identical quotes and recent OHLCV series. Querying upstream providers on every HTTP request risks throttling and degraded responsiveness.

## Decision
We implement a unified `CacheService` interface with Redis as the primary distributed caching tier and a process-local `InMemoryCacheService` as an automatic graceful fallback:
- Market Quotes: Short TTL (5–15 seconds) to buffer concurrent client requests while maintaining near real-time fidelity.
- Intraday OHLCV (1m, 5m, 15m): Moderate TTL (60 seconds) for incomplete current candles, longer TTL (300 seconds) for historical intervals.
- OHLCV: Configured TTL from `CACHE_OHLC_TTL`, currently 300 seconds by default.
- Cache Failure Resilience: Redis-backed deployments can fall back to the process-local cache implementation when configured by the cache factory.

## Consequences
### Positive
- Repeated identical reads avoid unnecessary provider calls while their cache entries remain valid.
- Protects upstream market providers from abusive request bursts.
- Robust operational resilience: Redis failure causes zero application downtime.

### Negative
- Requires careful cache key namespace design (`quote:{symbol}`, `ohlc:{symbol}:{tf}:{start}:{end}`) and invalidation strategies for mutating data.
