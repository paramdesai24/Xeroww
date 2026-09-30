# Market Data Ingestion Boundary Implementation Plan

## Objective

Create a small, explicit boundary between external market data and Xeroww application services. Keep Yahoo Finance as the active adapter, preserve all API and cache behavior, and make it possible to add another ingestion-backed adapter later without changing analytics consumers.

## Architecture

The existing `MarketDataProvider` remains the provider port. It will define the complete contract required by `MarketDataService`, including symbol normalization and instrument metadata lookup. Provider return values will use typed application records so that external library objects and provider-specific schemas stop at the adapter.

`YahooFinanceProvider` remains the only external adapter. It will continue to translate yfinance responses into Xeroww records. `MarketDataService` remains the application read and cache boundary. Routes and domain services will call this service or its public methods instead of reaching into the concrete provider.

The resulting flow is:

1. `YahooFinanceProvider` obtains external data and converts it to canonical records.
2. `MarketDataService` normalizes requests, applies existing cache behavior, sanitizes candles, and translates provider errors into HTTP errors.
3. Routes and domain services consume only `MarketDataService` methods or the compatible market-data reader surface.
4. `AnalyticsOrchestrator` continues to receive normalized candle dictionaries and remains unchanged.

No message broker, stream processor, warehouse, database change, or new data source is included.

## Files and Modules to Change

### `api/services/market_provider.py`

- Add typed records for instruments, quotes, and candles.
- Add provider metadata identifying the adapter without exposing yfinance details.
- Add abstract `normalize_symbol` and `get_instrument` methods because the application already depends on these capabilities.
- Remove yfinance-specific wording from the provider contract while keeping current period and interval parameters.

### `api/services/yahoo_provider.py`

- Implement provider metadata and instrument lookup.
- Type provider outputs with the canonical records.
- Keep all symbol validation, Yahoo mappings, yfinance calls, and response values unchanged.

### `api/services/market_data_service.py`

- Require an injected `MarketDataProvider` and remove direct construction of the Yahoo adapter.
- Add public `normalize_symbol` and `get_instrument` methods.
- Keep cache keys, time-to-live values, negative caching, candle sanitation, and HTTP error mapping unchanged.
- Continue exposing the provider internally for compatibility, while stopping downstream services from accessing it directly.

### `api/routes/ohlc.py`

- Remove the direct Yahoo metadata import.
- Resolve instrument display metadata through `MarketDataService`.
- Preserve the response schema and values.

### `api/services/correlation_service.py`

- Normalize symbols through the supplied market-data boundary instead of reaching into its provider attribute.
- Retain support for the existing lightweight provider test double.

### `api/services/decision_service.py`

- Normalize symbols through `MarketDataService` rather than its concrete provider.

### `api/services/thesis_review_service.py`

- Use the market-data boundary for fallback normalization rather than reaching into the provider.
- Preserve current fallback behavior when market data is unavailable.

### `api/tests/conftest.py`

- Extend the shared test provider with instrument lookup and provider metadata required by the completed contract.

### `api/tests/test_market_data_boundary.py`

- Add focused tests for provider injection, normalization, instrument lookup, caching, and provider-independent OHLC metadata.

## Functions and Interfaces

### Provider port

`MarketDataProvider` will expose:

- `metadata`: stable provider identity for diagnostics and future adapter selection.
- `normalize_symbol(symbol)`: converts an input symbol to the provider's canonical application symbol.
- `get_instrument(symbol)`: returns canonical display metadata for an equity or index.
- `get_stocks()`: returns the supported equity universe.
- `get_quote(symbol)`: returns a canonical quote.
- `get_ohlc(symbol, period, interval)`: returns canonical candles.
- `get_benchmark_ohlc(symbol, period, interval)`: retains the optional benchmark history capability.

The port describes application records, not yfinance objects. A future adapter may read from an ingestion store or stream materialization while implementing the same contract.

### Application service

`MarketDataService` will expose:

- `normalize_symbol(symbol)` as the supported normalization entry point for domain services.
- `get_instrument(symbol)` as the supported metadata entry point for routes.
- Existing stock, quote, candle, and benchmark methods without response changes.

## Data Flow and Control Flow

For candles:

1. A route or domain service calls `MarketDataService.get_candles`.
2. The service asks the provider port to normalize the symbol.
3. The service checks the existing candle cache key.
4. On a miss, the provider adapter retrieves and translates external data.
5. The service removes invalid numeric rows and writes the existing cache entry.
6. Analytics receives the canonical candle list.

For instrument metadata:

1. The OHLC route receives the normalized symbol returned with candles.
2. It calls `MarketDataService.get_instrument`.
3. The provider adapter resolves its private symbol mapping and returns an application instrument record.
4. The route builds the same response without importing Yahoo constants.

## Error Handling

- Invalid symbols continue to produce HTTP 404 responses at the service boundary.
- Provider runtime failures continue to produce HTTP 503 responses where currently defined.
- Unexpected quote and candle failures continue to produce HTTP 500 responses.
- Quote negative caching remains unchanged.
- Instrument lookup follows the same invalid-symbol translation as quote and candle requests.
- Thesis review continues to return an unavailable review when retrieval fails.

## Dependencies

- No new runtime or development dependencies.
- Dependency injection in `api/core/dependencies.py` already constructs the configured provider and passes it to `MarketDataService`, so it requires no behavior change.
- yfinance remains imported only by the Yahoo adapter.

## Edge Cases

- Equity symbols without the `.NS` suffix remain normalized by the Yahoo adapter.
- Supported caret-prefixed indices remain unchanged.
- Index display names must resolve without the OHLC route importing Yahoo mappings.
- Empty or invalid candle rows continue to be rejected by the service.
- Cached false-like values retain current handling because cache truthiness checks will not change.
- Lightweight test providers used directly by analytics services remain supported if they expose normalization and raw OHLC methods.

## Performance Considerations

- No additional external requests are introduced.
- Instrument lookup is an in-memory mapping operation in the Yahoo adapter.
- Existing cache keys and expiration values remain unchanged.
- Provider-independent tests use in-memory caches and deterministic adapters.

## Testing Considerations

Focused tests will verify:

1. An alternative provider implementation can be injected without importing or constructing Yahoo.
2. Symbol normalization is available through `MarketDataService`.
3. Quote and candle cache hits avoid duplicate provider calls and keep existing keys and behavior.
4. Instrument metadata, including an index, is resolved through the provider contract.
5. The OHLC endpoint can build its response from a non-Yahoo provider.
6. Existing backend tests continue to pass.
7. Backend lint passes.

## Implementation Steps

1. Define canonical record types, provider metadata, and the complete provider port.
2. Update the Yahoo adapter to implement the completed port without changing returned data.
3. Make provider injection explicit in `MarketDataService` and add its public normalization and instrument methods.
4. Replace the OHLC route's Yahoo metadata import with service-based lookup.
5. Replace direct provider reach-through in the three scoped domain services.
6. Update the shared mock provider.
7. Add focused boundary tests.
8. Run the focused tests, all backend tests, and backend lint.
9. Review the final diff for scope and behavior preservation.
