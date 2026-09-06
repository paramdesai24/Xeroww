# ADR 0001: Market Data Provider Abstraction

## Status
Accepted

## Context
Financial intelligence and algorithmic market structure calculation require access to real-time and historical OHLCV data. Financial data vendors vary widely in rate limits, pricing, reliability, protocol format, and geographic asset coverage (e.g., Yahoo Finance, Zerodha Kite Connect, Interactive Brokers, Bloomberg B-PIPE). Hardcoding direct vendor client calls within API routes or analytics algorithms couples business domain models to third-party vendor idiosyncrasies and hinders transition to high-throughput message brokers.

## Decision
We enforce a strict `MarketDataProvider` abstract base class defining vendor-agnostic contracts:
- `get_quote(symbol: str) -> MarketQuote`
- `get_ohlc(symbol: str, timeframe: str, start_time: datetime, end_time: datetime) -> list[OHLCRecord]`
- `search_symbols(query: str) -> list[InstrumentMetadata]`

The concrete implementation (`YahooProvider`) translates Yahoo Finance responses into internal domain models (`Candle`, `MarketQuote`). Services (`MarketDataService`, `PatternService`, `MarketStructureService`) depend strictly on `MarketDataProvider` via dependency injection.

## Consequences
### Positive
- Direct swapping of upstream market providers (e.g., Kite Connect or mock test providers) without touching analytics algorithms or endpoints.
- Simplifies unit testing via mock provider fixtures without network dependencies.
- Facilitates the V1.0 transition where historical data is ingested via streaming Kafka topics and stored in Apache Iceberg tables.

### Negative
- Requires normalization overhead for vendor-specific payload variations.
- Lowest common denominator contract prevents passing vendor-specific proprietary parameters directly to analytics engines.
