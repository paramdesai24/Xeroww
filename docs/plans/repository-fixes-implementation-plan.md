# Xeroww Repository Fixes Implementation Plan

## 1. Purpose

This plan defines the corrective work required after the full repository audit. It covers confirmed runtime defects, deployment gaps, misleading UI and documentation claims, inconsistent dependency boundaries, frontend quality warnings, missing regression coverage, and production-readiness gaps in the current modular monolith.

The plan is intentionally implementation-ready. A coding agent should be able to execute it without redesigning the solution.

## 2. Scope

### 2.1 In scope

- Repair confirmed API and frontend contract defects.
- Make PostgreSQL deployment functional.
- Introduce a production-safe database migration path.
- Remove fabricated Kafka and direct-feed provenance.
- Route market-data access through the configured provider and cache boundary.
- Make runtime versions and documentation consistent.
- Correct claims about WebSockets, event sourcing, CQRS, replay, multi-timeframe analysis, and distributed infrastructure.
- Resolve current React lint warnings without changing user-visible behavior.
- Split the frontend bundle along module and modal boundaries.
- Add backend and frontend regression tests for the corrected behavior.
- Validate Python, TypeScript, frontend build, database migration, and Docker Compose configuration.

### 2.2 Out of scope

- Kafka, Spark, Iceberg, Parquet, Kubernetes, or a distributed event store.
- WebSocket replay implementation.
- Broker integration or real order execution.
- RSI, MACD, Bollinger Bands, Fibonacci analytics, Dow Theory, CPR, or other concepts not yet completed through Zerodha Varsity.
- Predictive machine learning or probabilistic market forecasts.
- A complete redesign of the existing UI.
- Removal of the simulated portfolio feature. It will instead be documented accurately as a bounded decision-tracking subsystem.

## 3. Current Architecture to Preserve

The supported runtime remains a modular monolith:

```text
React client
  -> HTTP REST API
  -> FastAPI routes
  -> application and domain services
  -> deterministic analytics orchestrator
  -> MarketDataService
  -> configured MarketDataProvider
  -> Yahoo Finance in the current release

User state
  -> SQLAlchemy repositories through services
  -> SQLite for zero-configuration development
  -> PostgreSQL for Docker and production-like deployment

Transient infrastructure
  -> Redis with in-memory fallback
  -> synchronous InMemoryEventBus
  -> Prometheus metrics and lightweight trace headers
```

The main design objective is to make this architecture consistent and honest before adding distributed components.

## 4. Technical Decisions

### 4.1 API compatibility policy

- Preserve existing unversioned backend paths such as `/ohlc/{symbol}` and `/journal/{id}`.
- Treat `/api/*` as the public edge path exposed by Nginx. Nginx continues stripping `/api` before forwarding to FastAPI.
- Do not introduce `/api/v1` aliases in this repair because they would create two contracts without a migration need.
- Document internal direct-backend URLs separately from edge URLs.

### 4.2 Journal update semantics

- `PATCH /journal/{entry_id}` becomes the canonical partial-update method because all request fields are optional.
- Retain `PUT /journal/{entry_id}` as a compatibility alias during this release.
- Both methods must call the same route function and service method.
- The frontend continues using PATCH.

### 4.3 Provider and cache boundary

- `get_market_provider()` remains the provider factory.
- It must read `settings.MARKET_DATA_PROVIDER` and return Yahoo only when the configured value is `yahoo`.
- Unsupported provider values must fail at startup or dependency resolution with a clear configuration error. They must not silently fall back to Yahoo.
- Every HTTP route that needs quotes or candles must depend on `MarketDataService` instead of constructing `YahooFinanceProvider` directly.
- Domain analytics continue receiving normalized candle dictionaries and remain provider-independent.
- Cross-asset services must depend on a small market-data reader interface or `MarketDataService`, not the Yahoo implementation.

### 4.4 Caching policy

- Reuse `MarketDataService` cache keys and configured TTLs for quotes and candles.
- Keep the event timeline result cache only if profiling shows that event generation is materially expensive after candle caching. If retained, encapsulate it and bound its size.
- Do not add duplicate route-local candle caches.
- Market breadth must use cached quote reads.
- Correlation must use cached historical candle reads.

### 4.5 Database migrations

- Add Alembic as the authoritative schema migration tool for PostgreSQL and production-like environments.
- Create one baseline migration containing the active SQLAlchemy schema for users, watchlists, portfolios, holdings, transactions, alerts, journal entries, annotations, stocks, and daily candles.
- Preserve SQLite auto-creation for tests and zero-configuration local development only.
- Add an `AUTO_CREATE_TABLES` setting. Default it to true in development and false in production.
- Docker Compose must run migrations before starting the backend.
- Do not make application startup execute migrations implicitly.

### 4.6 PostgreSQL driver

- Use Psycopg 3 through `psycopg[binary]`.
- Standardize PostgreSQL URLs as `postgresql+psycopg://...` so SQLAlchemy selects the installed driver explicitly.
- Update examples, Compose configuration, and migration configuration together.

### 4.7 Provenance truthfulness

- Remove the client-generated Kafka topic, partition, offset, schema, ingestion latency, producer, and direct NSE feed claims.
- Rename `KafkaProvenance` to `DataProvenance`.
- Client-side X-Ray provenance may report only facts available to the client:
  - symbol
  - candle timestamp and index
  - source provider label supplied by application configuration
  - transport as REST
  - calculation location as browser
  - algorithm identifiers for the local anatomy, pattern, and structure calculations
  - whether the view is live-mode or replay-mode
- Server-side forensics remains authoritative for provider, algorithm version, calculation window, and source candle range.
- The UI must label planned Kafka lineage as future architecture, never as active telemetry.

### 4.8 Version source of truth

- Set the release version to `0.8.0`, matching the implemented fuzzy engine milestone.
- Backend version comes from `APP_VERSION`, defaulting to `0.8.0`.
- Frontend package version becomes `0.8.0`.
- Frontend display version comes from a Vite build-time constant derived from `package.json`, with `VITE_APP_VERSION` as an optional override.
- Remove hard-coded `v0.6` and `0.1.0` labels from components and config.

### 4.9 CQRS and event terminology

- Keep the current command/query records and abstract protocols as extension scaffolding.
- Do not claim routes execute through CQRS buses.
- Describe the event system as synchronous domain-event publishing through an in-memory bus.
- Do not call the current system event sourcing because events are not durably persisted and aggregates are not reconstructed from them.
- Rename or rewrite documentation headings accordingly while preserving the future migration design.

### 4.10 Replay transport

- Keep replay REST-based in this release.
- Browser playback continues issuing point-in-time REST requests at controlled intervals.
- Remove WebSocket endpoint claims from README and ADR current-state sections.
- WebSocket replay remains an explicit future milestone.
- Rename health UI language from `WebSocket` to `Realtime/Event Dispatch` unless actual WebSocket connections are introduced later.

### 4.11 Frontend data access

- Default `apiBaseUrl` to `/api` so the same client works through Vite's development proxy and production Nginx.
- Allow `VITE_API_URL` to override the base for direct backend development.
- Continue using the existing typed fetch client in this repair. Do not add TanStack Query solely for cleanup.

### 4.12 Frontend test stack

- Add Vitest, React Testing Library, `@testing-library/jest-dom`, and jsdom.
- Add `test` and `test:run` package scripts.
- Keep tests focused on corrected contracts and high-risk hooks/components rather than attempting broad snapshot coverage.

## 5. Workstream A: Repair Confirmed Runtime Defects

### A1. Journal PATCH and PUT compatibility

Files:

- `api/routes/journal.py`
- `dashboard/src/api/client.ts`
- `api/tests/test_differentiated_intelligence.py` or a new `api/tests/test_journal_api.py`

Changes:

1. Register both PATCH and PUT for `/{entry_id}`.
2. Use one handler body so validation, authorization, event publishing, and response serialization remain identical.
3. Keep `JournalEntryUpdate` as a partial-update schema.
4. Confirm the frontend sends PATCH.
5. Add tests for:
   - PATCH status only
   - PATCH thesis only
   - PUT compatibility
   - invalid status returns 422
   - cross-tenant update returns 404

Acceptance criteria:

- The Journal UI can change an entry status successfully.
- Existing PUT API consumers do not break.

### A2. Replay jump dictionary access

Files:

- `api/routes/replay.py`
- `api/tests/test_replay_and_diff.py`

Changes:

1. Read `current_step` from the dictionary returned by `run_replay_jump`.
2. Record the clamped, resolved step rather than the requested timestamp position.
3. Add route tests for:
   - exact timestamp
   - timestamp between bars selects the preceding bar
   - timestamp before the first bar selects step zero
   - timestamp after the last bar selects the final step
   - empty series follows the existing safe response contract

Acceptance criteria:

- `/replay/jump/{symbol}` returns HTTP 200 and a valid `ReplayStepResponse` for all supported timestamp positions.

### A3. Error-contract consistency

Files:

- `api/main.py`
- `api/core/exceptions.py`
- affected routes that currently raise ad hoc `HTTPException`
- `api/schemas/common.py`
- API tests

Changes:

1. Preserve FastAPI's `detail` field for frontend compatibility.
2. Ensure Xeroww exceptions include stable error code, message, details, timestamp, and request/trace identifier.
3. Add a handler for relevant `HTTPException` cases if a unified envelope can be introduced without breaking tests.
4. Do not expose raw provider exception internals in production responses. Log the full exception and return a stable market-data error.
5. Confirm 404, 422, 429, 502/503, and authentication failures have predictable shapes.

Acceptance criteria:

- Existing client error parsing continues working.
- Provider implementation details and stack context are not leaked to clients.

## 6. Workstream B: Make Persistence and Docker Deployment Functional

### B1. Add Psycopg and standardize URLs

Files:

- `api/requirements.txt`
- `docker-compose.yml`
- `.env.example`
- `api/.env.example`
- `README.md`

Changes:

1. Add a bounded Psycopg 3 binary dependency.
2. Change PostgreSQL examples and Compose URL to `postgresql+psycopg://`.
3. Add missing production environment variables to the API example file or replace the duplicate API example with a pointer to the root example.
4. Ensure secrets remain environment-provided and development defaults are clearly marked unsafe for production.

### B2. Add Alembic

New files:

- `alembic.ini`
- `api/database/migrations/env.py`
- `api/database/migrations/script.py.mako`
- `api/database/migrations/versions/<revision>_baseline_schema.py`

Modified files:

- `api/core/config.py`
- `api/database/session.py`
- `api/main.py`
- `docker-compose.yml`
- `Makefile`
- `README.md`

Migration contents:

- users
- watchlists
- watchlist_items
- portfolios
- holdings
- portfolio_transactions
- alerts
- decision_journal_entries
- chart_annotations
- stocks
- daily_candles
- all current foreign keys, indexes, unique constraints, enum representations, nullable rules, and timestamps

Control flow:

1. Docker starts PostgreSQL.
2. A one-shot migration service runs `alembic upgrade head` using the backend image.
3. Backend waits for successful migration completion.
4. Backend starts without calling `create_all_tables` in production.
5. Local development may still call `create_all_tables` when `AUTO_CREATE_TABLES=true`.

Edge cases:

- An existing database created by `create_all` needs a documented `alembic stamp head` adoption path.
- SQLite test databases continue using fixture-controlled metadata creation.
- Enum migrations must behave consistently on SQLite and PostgreSQL.
- Migration failure must stop backend startup in Compose.

### B3. Retire or regenerate reference SQL

Files:

- `database/schema.sql`
- `database/README.md`

Decision:

- Do not maintain a second hand-written production schema.
- Replace `schema.sql` with a clearly labeled legacy/reference artifact or remove its schema authority.
- Point operators to Alembic for the complete schema.
- If retained, state that it covers only early market tables and must not be used to initialize the application database.

### B4. Infrastructure validation

Checks:

- `docker compose config --quiet`
- Alembic upgrade against temporary SQLite
- Alembic upgrade against PostgreSQL through Compose when Docker is available
- Backend container health check
- Frontend and edge Nginx health checks
- A smoke request through `http://localhost/api/health`

## 7. Workstream C: Enforce the Market Data Boundary

### C1. Provider factory configuration

Files:

- `api/core/dependencies.py`
- `api/core/config.py`
- `api/services/market_provider.py`
- dependency tests

Changes:

1. Add explicit return types.
2. Select provider from `MARKET_DATA_PROVIDER`.
3. Support `yahoo` only in this release.
4. Raise a clear configuration error for `kafka`, `spark`, or unknown values.
5. Add a test reset mechanism for provider and market-service singletons so test overrides cannot leak across cases.

### C2. Refactor direct-provider routes

Files:

- `api/routes/replay.py`
- `api/routes/events.py`
- `api/routes/forensics.py`
- `api/routes/diff.py`
- `api/routes/fuzzy.py`
- `api/routes/intelligence.py`
- `api/services/market_breadth_service.py`
- `api/services/correlation_service.py`
- `api/services/thesis_review_service.py`
- relevant tests

Changes by route:

- Replay: obtain normalized symbol and candles from injected `MarketDataService`.
- Events: use the same service and cached candle history.
- Forensics: construct `CandleForensicsService` from injected normalized data.
- Event diff: construct `EventDiffService` from injected normalized data.
- Fuzzy: remove module-level Yahoo provider and fetch through the injected service.
- Intelligence breadth: read stocks and quotes through cached service methods.
- Correlation: obtain candles through the shared service while preserving timestamp alignment.
- Thesis review: inject a market-data reader from `JournalService` rather than relying on a module-level Yahoo-specific reviewer.

Interface design:

- Introduce a small `MarketDataReader` protocol if importing `MarketDataService` into analytical services creates unnecessary coupling.
- Required methods are `get_stocks`, `get_quote`, and `get_candles`.
- The protocol returns normalized application dictionaries, not vendor objects.

Error handling:

- Preserve 404 for unsupported symbols.
- Use 503 for upstream unavailability.
- Avoid converting every unexpected error to a provider-specific 502 string.

Performance:

- A single frontend market refresh currently requests quote, OHLC, patterns, and structure concurrently. Shared caching must prevent repeated Yahoo calls for identical candle keys.
- Add a test with a counting provider to prove one provider fetch serves repeated identical requests within TTL.

### C3. Remove obsolete direct imports

Verification:

- `yfinance` may appear only in `api/services/yahoo_provider.py`.
- Route modules must not import `YahooFinanceProvider`.
- Provider-specific types must not appear in reusable analytical services.

## 8. Workstream D: Replace Fabricated Provenance

### D1. Redesign client provenance types

Files:

- `dashboard/src/types/xray.ts`
- `dashboard/src/components/xray/utils/provenance.ts`
- `dashboard/src/hooks/useSelectedCandle.ts`
- `dashboard/src/components/xray/XRayProvenance.tsx`
- `dashboard/src/components/xray/XRayDrawer.tsx`
- `dashboard/src/config.ts`

Replace `KafkaProvenance` with `DataProvenance` fields:

- `sourceProvider`
- `sourceKind`
- `transport`
- `symbol`
- `candleTimestamp`
- `candleIndex`
- `calculationLocation`
- `algorithms`
- `mode`
- `limitations`

Behavior:

- Use Yahoo Finance delayed-feed wording from centralized config.
- Mark client calculations as browser-derived from the currently loaded candle slice.
- Mark replay calculations as point-in-time when replay mode is active.
- Do not generate fake trace identifiers, ingestion timestamps, offsets, or latencies.
- Do not imply direct exchange connectivity.

### D2. Update provenance UI

Changes:

- Replace `KAFKA-READY` status with `LOCAL ANALYSIS` or `SERVER VERIFIED`, depending on the source.
- Show source, transport, candle position, algorithms, and limitations.
- Provide a link or action to open server-side forensics when available.
- Add a small future-state note saying Kafka lineage is planned, without showing synthetic values.

### D3. Strengthen server-side provenance

Files:

- `api/services/forensic_service.py`
- `api/schemas` if a typed forensic schema is introduced
- forensics tests

Changes:

- Use timezone-aware UTC calculation timestamps.
- Pass provider identity from the configured provider rather than hard-coding it in the static builder.
- Preserve source candle range, bar count, timeframe, and algorithm version.
- Add explicit `transport` and `data_freshness_note` fields.
- Ensure historical replay provenance never claims live data.

## 9. Workstream E: Align Runtime Contracts, Versions, and Documentation

### E1. Version cleanup

Files:

- `api/core/config.py`
- `api/main.py`
- `.env.example`
- `api/.env.example`
- `dashboard/package.json`
- `dashboard/package-lock.json`
- `dashboard/src/config.ts`
- `dashboard/src/components/ModuleNav.tsx`
- `README.md`
- fuzzy documentation headers

Acceptance criteria:

- API root response, OpenAPI, navigation badge, package metadata, and documentation report 0.8.0 unless explicitly overridden.

### E2. README corrections

File:

- `README.md`

Required corrections:

- React 19, TypeScript 6, Vite 8, and current library versions.
- Python 3.11 as the supported container and CI version unless the runtime is deliberately upgraded.
- Actual unversioned backend paths and `/api` edge routing.
- REST replay rather than WebSocket replay.
- Single-timeframe daily alignment rather than multi-timeframe confluence.
- Synchronous in-memory domain events rather than event sourcing.
- CQRS scaffolding rather than active command/query dispatch.
- Current fixed five-symbol NSE universe.
- SQLite development and PostgreSQL deployment behavior.
- Alembic migration commands.
- Fuzzy V0.8 feature documentation.
- Clear current versus future architecture sections.
- Remove broker-execution roadmap language that conflicts with the canonical project identity.
- Describe simulated portfolios as decision review and accounting context, not the product identity.

### E3. ADR corrections

Files:

- `docs/adr/0001-provider-abstraction.md`
- `docs/adr/0004-replay-design.md`
- `docs/adr/0005-caching-strategy.md`
- `docs/adr/0006-observability-strategy.md`
- `docs/architecture/event_sourcing.md`
- `docs/architecture.md`

Changes:

- Update interface signatures to match actual code.
- Separate accepted current decisions from target-state proposals.
- Remove current WebSocket claims.
- Correct cache behavior and avoid unsupported latency claims unless benchmark evidence exists.
- Describe tracing as OpenTelemetry-compatible context propagation, not full OpenTelemetry telemetry export.
- Rename event-sourcing documentation to domain events and CQRS preparation, or explicitly mark event sourcing as future work.
- State that CQRS buses have protocols only and routes call services directly.
- Replace Snowflake references with the canonical Iceberg/Parquet target where appropriate.

### E4. Database and context documentation

Files:

- `database/README.md`
- `database/schema.sql`
- `context-folder/context-file.md`, only if factual current-state wording is present

Rules:

- Preserve the canonical vision.
- Add a separate current-state section rather than weakening the long-term goal.
- Never mark planned infrastructure as deployed.

## 10. Workstream F: Frontend Reliability and Bundle Structure

### F1. API base URL

Files:

- `dashboard/src/config.ts`
- `dashboard/vite.config.ts`
- `dashboard/Dockerfile`
- README development instructions

Changes:

- Default to `/api`.
- Keep Vite proxy rewriting `/api` to the local backend.
- Permit a build-time or runtime override through `VITE_API_URL`.
- Verify direct development and edge-Nginx deployment.

### F2. Resolve React lint warnings

Files currently implicated:

- `dashboard/src/App.tsx`
- `dashboard/src/hooks/useAuth.ts`
- `dashboard/src/hooks/useMarketData.ts`
- `dashboard/src/hooks/useSelectedCandle.ts`
- `dashboard/src/components/Sidebar.tsx`
- `dashboard/src/components/CandleForensicsModal.tsx`
- `dashboard/src/components/WatchlistManager.tsx`
- `dashboard/src/components/EventDiffModal.tsx`
- `dashboard/src/components/AlertsManager.tsx`
- `dashboard/src/components/MarketBreadthModal.tsx`
- `dashboard/src/components/PortfolioView.tsx`
- `dashboard/src/components/ReplayControlBar.tsx`
- `dashboard/src/components/JournalView.tsx`
- `dashboard/src/components/SystemView.tsx`
- `dashboard/src/components/xray/XRayDrawer.tsx`

Implementation rules:

1. Move `fetchStep` above effects that reference it.
2. Give asynchronous loading callbacks stable dependencies through `useCallback`.
3. Avoid synchronous state resets in effects when the value can be derived from props or initialized at event boundaries.
4. Do not suppress lint rules globally.
5. Do not add stale closures to make warnings disappear.
6. Use cancellation flags or `AbortController` for requests that may resolve after unmount or symbol change.
7. Preserve replay timer cleanup and ensure only one interval exists.
8. Ensure external event jumps cannot race with autoplay step requests.

Replay-specific control flow:

```text
symbol changes
  -> cancel current request and timer
  -> load timeline
  -> set step zero
  -> fetch step zero

manual seek or external event jump
  -> clamp index
  -> stop or coordinate autoplay
  -> update visible step
  -> fetch exactly that step
  -> ignore stale responses

autoplay
  -> one timer
  -> calculate next index from current state
  -> stop at final bar
  -> fetch next snapshot
```

### F3. Introduce code splitting

Files:

- `dashboard/src/App.tsx`
- optionally a new `dashboard/src/components/AsyncBoundary.tsx`

Lazy-load candidates:

- WatchlistManager
- PortfolioView
- AlertsManager
- JournalView
- SystemView
- CandleForensicsModal
- EventDiffModal
- MarketBreadthModal
- AuthModal

Keep the primary market chart and immediate market sidebar eager.

Requirements:

- Use `React.lazy` and `Suspense` with existing skeleton styles.
- Avoid creating a separate chunk for very small shared UI primitives.
- Verify that chunking lowers the main entry chunk below the current warning threshold where practical.
- Confirm lazy module failures show a recoverable error state rather than a blank screen.

### F4. Correct system-health terminology

Files:

- `dashboard/src/components/SystemView.tsx`
- `dashboard/src/types/health.ts`
- `api/schemas/health.py`
- `api/routes/system_health.py`
- `api/services/health_registry.py`
- tests

Changes:

- Rename user-facing WebSocket labels to event dispatch or realtime gateway telemetry.
- Preserve response compatibility if renaming JSON keys would be disruptive. In that case, deprecate the old key and correct only labels and descriptions.
- Never display a connected-client count as real WebSocket clients when no WebSocket endpoint exists.
- Separate domain events published from network messages sent.

## 11. Workstream G: Testing Strategy

### G1. Backend unit and API tests

Add or extend coverage for:

- Journal PATCH and PUT compatibility.
- Replay jump route and timestamp boundaries.
- Provider factory configuration.
- Route-level dependency overrides for replay, events, forensics, fuzzy, diff, and intelligence.
- Cache reuse across repeated requests.
- Forensics provenance accuracy.
- Unsupported provider configuration errors.
- Production auto-create disabled behavior.
- Alembic baseline upgrade.
- Updated health terminology and counters.
- Standardized error envelopes.

### G2. Frontend tests

New configuration/files:

- `dashboard/vitest.config.ts`, or test configuration inside `vite.config.ts`
- `dashboard/src/test/setup.ts`
- focused `*.test.ts` and `*.test.tsx` files

Required tests:

- API client uses PATCH for journal updates.
- API base URL defaults to `/api`.
- Replay control initializes, seeks, handles external jumps, autoplays, and cancels timers.
- X-Ray provenance contains no Kafka or direct NSE feed claims.
- Module-level lazy loading renders fallback and resolved content.
- Authentication refresh preserves tokens on success and clears them on failure.
- Request components ignore stale responses after prop changes or unmount.

### G3. Existing test suite protection

- All existing 203 backend tests must remain passing.
- Do not weaken tenant-isolation, replay leakage, fuzzy, event, cache, or resilience assertions.
- Update tests only when the public contract is intentionally corrected.

### G4. Quality commands

Backend:

```text
api/venv/Scripts/python.exe -m ruff check api --select=E,F,W --ignore=E501,E402,E741
api/venv/Scripts/python.exe -m pytest api/tests -q
```

Frontend:

```text
npm run lint
npm run test:run
npm run build
```

Infrastructure:

```text
docker compose config --quiet
alembic upgrade head
alembic downgrade base
alembic upgrade head
```

The downgrade cycle should run only against a disposable test database.

## 12. Error Handling Requirements

- Invalid or unsupported symbols return 404 without a provider stack trace.
- Provider outages return a stable 503 response.
- Invalid application configuration fails clearly and early.
- Redis failure continues degrading to in-memory cache.
- Migration failure prevents backend startup in production Compose.
- Partial portfolio valuation remains available when one quote fails, with missing valuation fields rather than fabricated zeroes.
- Fuzzy analysis returns `INSUFFICIENT_DATA` for short history and does not fail the complete market page.
- Frontend lazy-load, request, and replay failures show an actionable retry state.
- Stale asynchronous responses must not replace data for a newly selected symbol.

## 13. Performance Considerations

- Continue computing analytics in-process because the current five-symbol daily-data workload does not justify distributed processing.
- Prevent duplicate Yahoo requests through shared candle caching.
- Bound any in-memory derived-result cache by TTL and maximum entries.
- Avoid running full market-structure analysis more than once per identical request pipeline where results can be composed from a single summary.
- Lazy-load non-market modules and modals.
- Do not introduce excessive memoization. Use it only for expensive deterministic chart and X-Ray computations.
- Measure the production entry chunk after splitting and record the result in the final implementation report.
- Preserve normalized Prometheus paths to avoid high-cardinality labels.

## 14. Security Considerations

- Preserve tenant-scoped database filters on every user-owned operation.
- Keep 404 behavior for cross-tenant resource access.
- Do not put JWTs, email addresses, symbols from arbitrary URL segments, or raw exception messages into metric labels.
- Do not expose database credentials in logs or health responses.
- Do not use development JWT defaults in production examples.
- Migration services must receive the database URL through environment configuration.
- Token refresh and revocation behavior must remain covered by tests.

## 15. Step-by-Step Execution Order

### Phase 1: Establish regression tests

1. Add failing backend tests for journal PATCH and replay jump.
2. Add provider-injection tests for direct-provider routes.
3. Add provenance assertions that reject Kafka and direct-feed claims.
4. Add the frontend test framework and initial failing contract tests.

### Phase 2: Fix immediate runtime defects

1. Implement journal PATCH plus PUT compatibility.
2. Fix replay jump state access.
3. Harden affected error responses.
4. Run targeted and full backend tests.

### Phase 3: Repair provider and caching architecture

1. Implement configured provider selection.
2. Introduce or finalize the market-data reader interface.
3. Refactor replay, events, forensics, diff, fuzzy, intelligence, and thesis review.
4. Remove direct Yahoo imports from routes.
5. Verify cache reuse and error behavior.

### Phase 4: Repair provenance

1. Replace client provenance types and generator.
2. Update X-Ray UI.
3. Strengthen server forensics metadata.
4. Run frontend and backend provenance tests.

### Phase 5: Make PostgreSQL deployment operational

1. Add Psycopg.
2. Standardize database URLs.
3. Add Alembic configuration and baseline migration.
4. Gate `create_all` by environment setting.
5. Add Compose migration service and dependency ordering.
6. Validate against disposable databases.

### Phase 6: Frontend reliability

1. Change default API base to `/api`.
2. Resolve replay callback and race issues first.
3. Resolve remaining effect and dependency warnings file by file.
4. Add lazy module and modal boundaries.
5. Run lint, tests, and production build.

### Phase 7: Documentation and version alignment

1. Set version 0.8.0 everywhere.
2. Rewrite README current-state and roadmap sections.
3. Correct ADRs and architecture documentation.
4. Retire manual schema authority.
5. Verify all documented commands and endpoint examples.

### Phase 8: Final validation

1. Run all backend tests and lint.
2. Run all frontend tests, lint, and build.
3. Validate Alembic upgrade and disposable downgrade cycle.
4. Validate Docker Compose configuration.
5. Start the stack when Docker is available and smoke-test health, market data, auth, journal update, replay jump, fuzzy output, and metrics.
6. Confirm `git diff` contains only intended changes.

## 16. Completion Criteria

The repair project is complete only when all conditions below are satisfied:

- Journal updates work from the frontend and through both PATCH and PUT APIs.
- Replay jump works for exact, preceding, before-range, and after-range timestamps.
- PostgreSQL has an installed driver and a successful migration path.
- Production Compose runs migrations before backend startup.
- No route directly constructs or imports `YahooFinanceProvider`.
- Repeated identical market reads use the shared cache.
- No UI displays fabricated Kafka, exchange-feed, offset, latency, or schema telemetry.
- No current-state documentation claims an active WebSocket, Kafka, Spark, Iceberg, Kubernetes, event-sourced, or fully CQRS runtime.
- All version surfaces report 0.8.0 by default.
- Frontend uses `/api` correctly through development and production proxies.
- React lint completes without the currently reported hook, initialization, or set-state-in-effect warnings.
- Frontend production build succeeds with meaningful module splitting.
- All existing and new backend tests pass.
- All new frontend tests pass.
- Ruff, frontend lint, Docker Compose validation, and migration validation pass.
- The canonical long-term vision remains intact and is clearly separated from the implemented current state.

## 17. Deliverables

- Corrected backend and frontend implementation.
- Alembic baseline migration and operational commands.
- Updated dependency lockfiles.
- Backend regression tests.
- Frontend test infrastructure and focused regression tests.
- Corrected README, ADRs, architecture documents, and database documentation.
- Final validation report listing commands, results, remaining warnings, and any environment-dependent checks that could not be run.
