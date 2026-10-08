# Snowflake analytical query repository

`MarketFeatureAnalyticsRepository` is the read-only boundary for querying the
configured `LATEST_MARKET_FEATURES` view. It has no FastAPI dependency and uses
an injected query client, so ordinary application startup and offline tests do
not require Snowflake credentials or a Snowflake connection.

The first query returns latest feature revisions for one normalized symbol and
a bounded, half-open `window_start` range of `[start_time, end_time)`. Symbols
are trimmed and uppercased consistently with the ingestion contract. Caller
timestamps must include a timezone and are converted to UTC. Snowflake
`TIMESTAMP_NTZ` window values are interpreted as UTC when they are mapped into
the typed read model.

All values, including the result limit, use connector parameters. Only validated
database, schema, and view identifiers are included in SQL text. The concrete
client rejects non-`SELECT` statements before opening a connection.

## HTTP boundary

The backend exposes this repository through
`GET /analytics/features/{symbol}`. In the deployed reverse-proxy layout the
public path is `GET /api/analytics/features/{symbol}`. Required `start_time` and
`end_time` query parameters are timezone-aware, and `limit` defaults to 500 with
a maximum of 5000.

The route uses FastAPI dependency injection and never creates a Snowflake
connection during import or registration. Missing warehouse configuration maps
to HTTP 503. Query and malformed-row failures map to HTTP 502. An empty result
remains a successful response with an empty `data` collection.
