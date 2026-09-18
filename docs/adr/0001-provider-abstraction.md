# ADR 0001: Market Data Provider Abstraction

## Status
Accepted

## Context
Financial intelligence and algorithmic market structure calculation require access to real-time and historical OHLCV data. Financial data vendors vary widely in rate limits, pricing, reliability, protocol format, and geographic asset coverage (e.g., Yahoo Finance, Zerodha Kite Connect, Interactive Brokers, Bloomberg B-PIPE). Hardcoding direct vendor client calls within API routes or analytics algorithms couples business domain models to third-party vendor idiosyncrasies and hinders transition to high-throughput message brokers.

## Decision
We enforce a strict `MarketDataProvider` abstract base class defining vendor-agnostic contracts for stock metadata, quote reads, and period/interval candle reads. `MarketDataService` wraps the configured provider with the shared cache boundary.

The concrete `YahooFinanceProvider` normalizes Yahoo Finance responses. Routes receive `MarketDataService` through FastAPI dependency injection and analytics services consume the resulting normalized data.

## Consequences
### Positive
- Direct swapping of upstream market providers (e.g., Kite Connect or mock test providers) without touching analytics algorithms or endpoints.
- Simplifies unit testing via mock provider fixtures without network dependencies.
- Preserves an explicit seam for a future streaming or warehouse-backed provider. Those systems are not deployed in V0.8.

### Negative
- Requires normalization overhead for vendor-specific payload variations.
- Lowest common denominator contract prevents passing vendor-specific proprietary parameters directly to analytics engines.
