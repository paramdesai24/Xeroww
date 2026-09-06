# ADR 0005: Multi-Tiered Market Data Caching Strategy

## Status
Accepted

## Context
Upstream market data providers enforce restrictive rate limits and introduce variable network latencies (150ms–1500ms). Downstream clients repeatedly request identical quotes and recent OHLCV series. Querying upstream providers on every HTTP request risks IP throttling, degrades user responsiveness, and limits horizontal scalability.

## Decision
We implement a unified `CacheService` interface with Redis as the primary distributed caching tier and a process-local `InMemoryCacheService` as an automatic graceful fallback:
- Market Quotes: Short TTL (5–15 seconds) to buffer concurrent client requests while maintaining near real-time fidelity.
- Intraday OHLCV (1m, 5m, 15m): Moderate TTL (60 seconds) for incomplete current candles, longer TTL (300 seconds) for historical intervals.
- Daily/Historical OHLCV (1d): Long TTL (3600 seconds) as historical daily bars are immutable.
- Cache Failure Resilience: If Redis connection fails or times out, the backend logs a warning and automatically falls back to local in-memory LRU caching without crashing the application or returning HTTP 500 errors to users.

## Consequences
### Positive
- P95 latency for repeated queries reduced from ~400ms to <1ms.
- Protects upstream market providers from abusive request bursts.
- Robust operational resilience: Redis failure causes zero application downtime.

### Negative
- Requires careful cache key namespace design (`quote:{symbol}`, `ohlc:{symbol}:{tf}:{start}:{end}`) and invalidation strategies for mutating data.
