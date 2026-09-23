# Portfolio, Watchlists, and Alerts Experience Upgrade Plan

## Objective

Raise the authenticated Portfolio, Watchlists, and Alerts experiences to the quality of the Decision Journal while keeping each screen compact, calm, and immediately useful.

The work is intentionally split into three implementation chunks. Each chunk must be independently usable, tested, and reviewable. A shared error-handling foundation begins in Chunk 1 and is applied throughout all three chunks so raw API JSON is never rendered in the product UI.

## Product principles

1. Show the decision first and the explanation second.
2. Keep the default view to four primary metrics or fewer.
3. Use one-line summaries in rows and cards. Put formulas, provenance, history, and secondary evidence behind details, drawers, or dedicated routes.
4. Keep destructive and high-impact actions explicit and confirmed.
5. Preserve Xeroww's descriptive, deterministic, and non-advisory language.
6. Use the existing graphite visual system, typography tokens, spacing scale, and tabular numerals.
7. Every asynchronous state must have a deliberate loading, empty, partial-data, success, and error presentation.
8. Never render exception strings, validation arrays, serialized objects, or raw JSON directly to users.

## Current-state findings

### Portfolio

- The page already supports multiple portfolios, holdings, contribution data, transaction history, simulated trades, and navigation into Portfolio Intelligence.
- The component is monolithic and manages several unrelated request states in one file.
- Initial loading errors and portfolio selection errors are swallowed.
- The layout uses a permanent sidebar and dense tables but lacks a clear page title, compact hierarchy, refresh state, sorting, and focused action flow.
- Symbol entry is free text even though the application already has a NIFTY 50 symbol catalogue and ranked symbol search behaviour.
- Trading submits directly from a form with limited pre-submit context.

### Watchlists

- The page supports create, delete, add symbol, remove symbol, and selection.
- The API supports rename, but the UI does not expose it.
- Rows only show ticker symbols, so the page does not yet function as a useful monitoring workspace.
- Symbol entry is free text and several errors are swallowed.
- There is no compact route into Market, Alerts, or the Decision Workbench from a symbol row.

### Alerts

- The page supports creation, deletion, individual evaluation, and evaluate-all.
- Alert conditions are entered as JSON, which exposes an implementation detail to users and creates avoidable validation errors.
- Conditions are shown as serialized JSON in the alert list.
- Evaluation results only live in component state and disappear on refresh.
- The existing model has an `enabled` field, but the UI and API do not offer pause or resume controls.
- Alert history, filtering, status hierarchy, and direct decision handoff are missing.

### Application-wide errors

- The frontend API client serializes FastAPI validation arrays with `JSON.stringify`, causing raw messages such as the `session_id = NaN` error shown in the supplied screenshot.
- Route pages parse numeric URL parameters without a reusable validity guard.
- Some components swallow request failures, while others display arbitrary exception strings.
- The backend formats Xeroww domain exceptions but does not normalize FastAPI request validation errors, standard HTTP errors, and unexpected failures into the same envelope.
- There is no shared inline error notice, page-level failure state, field-error presentation, or React render error boundary.

## Shared architecture and UX contract

### Page composition

All three pages should use the same hierarchy:

1. Compact header with title, one-line purpose, freshness or count metadata, and one primary action.
2. KPI strip with two to four high-value metrics.
3. Small control row for portfolio or watchlist selection, tabs, search, sorting, or status filters.
4. Primary table or list with one-line summaries and restrained actions.
5. Drawers, dialogs, expandable details, or dedicated routes for creation, history, formulas, and secondary explanations.

The default viewport must not contain long explanatory paragraphs, serialized payloads, or permanently open forms. Explanations should generally stay under six words in metric cards and one line in data rows.

### Shared frontend state model

Each page-level hook should expose a consistent state contract:

- `data`: last successfully loaded domain data.
- `loading`: true only for first load.
- `refreshing`: true when retaining existing data during refresh.
- `mutation`: the specific operation currently running.
- `error`: a normalized `AppError` or null.
- `reload()`: retry the primary read.
- Domain mutation functions that return success or throw normalized errors.

Existing data should remain visible during a background refresh. A failed mutation must not erase a previously successful page state.

### Application-wide error model

Add a single frontend `ApiError` or `AppError` type with:

- Stable code.
- HTTP status when available.
- Human-readable title.
- Human-readable message.
- Optional field errors keyed by field name.
- Optional request ID for support and diagnostics.
- Retryable flag.
- Original technical details retained for development logging only.

Update `apiFetch` so it understands all currently possible backend forms:

- Xeroww envelope: `error.code`, `error.message`, `error.details`, and `request_id`.
- String `detail` from FastAPI or an `HTTPException`.
- Array `detail` from Pydantic validation.
- Empty, non-JSON, network, timeout, and aborted responses.
- Authentication expiry and forbidden access.

Validation locations such as `body.symbol` or `path.session_id` must be converted into field labels and short messages. For example, an invalid replay route should become `This replay session link is invalid.` rather than showing a validation array.

Add shared presentation primitives:

- `ErrorNotice`: compact inline error with optional retry and dismiss actions.
- `PageErrorState`: page-level failure with clear recovery action.
- `FieldError`: input-level validation feedback.
- `EmptyState`: short explanation and one next action.
- `LoadingState` or skeleton compositions matched to the final layout.
- `SuccessNotice`: restrained confirmation for completed mutations.
- `AppErrorBoundary`: catches render failures and shows a safe recovery screen.

Add a reusable positive-integer route parameter parser. Pages must validate route parameters before calling an API. Invalid parameters render `PageErrorState`, do not issue a request, and provide a link back to the relevant list page.

### Backend error envelope

Standardize API failure responses to:

- `error.code`
- `error.message`
- `error.details`
- `timestamp`
- `request_id`

Add exception handlers for:

- `RequestValidationError`, producing stable `VALIDATION_ERROR` plus field-level details.
- Starlette or FastAPI `HTTPException`, producing an appropriate stable code.
- Xeroww domain exceptions, preserving the existing behaviour.
- Unexpected exceptions, logging technical context server-side and returning a generic `INTERNAL_ERROR` message without stack traces or implementation details.

The API remains machine-readable JSON, as expected for an API. The frontend is responsible for presenting that envelope as a formatted product message.

### Shared visual and accessibility rules

- Use CSS variables already defined in `index.css` instead of introducing new hard-coded colour families.
- Body copy uses the sans font. Symbols, prices, percentages, and timestamps use the mono font with tabular numerals.
- Minimum interactive target height is 32 pixels on desktop and 40 pixels on narrow screens.
- Visible focus states are mandatory.
- Icon-only controls need accessible labels and tooltips.
- Positive and negative states must use text or icons in addition to colour.
- Dialogs and drawers must trap focus, close with Escape, and return focus to the trigger.
- Tables must have meaningful headers. Narrow layouts may turn rows into compact cards without hiding primary actions.

## Chunk 1: Shared error foundation and Portfolio upgrade

### Product outcome

The Portfolio page becomes a concise portfolio command centre. A user can understand total value, available cash, exposure, and unrealized result in seconds, inspect holdings or activity, and deliberately enter either Portfolio Intelligence or a simulated trade flow.

### Target information architecture

#### Header

- Title: `Portfolio`.
- Active portfolio selector with a compact create option.
- One-line metadata: last valuation time and delayed-data status.
- Primary action: `Record Trade`.
- Secondary action: `Open Intelligence`.

#### KPI strip

Show only:

1. Total value.
2. Available cash.
3. Invested value.
4. Unrealized P&L with percentage.

Do not add descriptive paragraphs to the cards. Each card receives a label, value, and at most a five or six word context line.

#### Primary workspace

- Default tab: Holdings.
- Secondary tabs: Activity and Today's Contribution.
- Holdings columns: symbol, quantity, average, current, value, P&L, allocation, and compact actions.
- Default sorting: current value descending.
- Optional sorts: P&L, allocation, and symbol.
- Row actions: open Market, plan or review Decision, and initiate Sell.
- Keep Portfolio Intelligence on its existing dedicated full-page routes. Do not duplicate its detailed calculations inside the overview.

#### Trade drawer

- Replace the permanently visible trade tab with a right-side drawer or modal.
- Use the NIFTY 50 autocomplete already established for Decision creation.
- Fields: symbol, side, quantity, and optional execution price.
- Show a compact pre-submit summary: estimated order value, remaining cash for BUY, owned quantity for SELL, and data-source note.
- Use a confirmation step because the transaction ledger is immutable.
- Retain the `Plan Evidence and Risk First` handoff as a secondary action.
- On success, close or reset the drawer, refresh the portfolio, and show a compact confirmation notice.

### Frontend architecture

Refactor the current monolith into:

- `pages/PortfolioPage.tsx`: orchestration and route-level layout.
- `features/portfolio/hooks/usePortfolioWorkspace.ts`: portfolio list, active selection, summary, transactions, contribution, refresh, and mutation states.
- `features/portfolio/components/PortfolioHeader.tsx`.
- `features/portfolio/components/PortfolioMetrics.tsx`.
- `features/portfolio/components/HoldingsTable.tsx`.
- `features/portfolio/components/PortfolioActivity.tsx`.
- `features/portfolio/components/ContributionTable.tsx`.
- `features/portfolio/components/TradeDrawer.tsx`.
- `features/portfolio/formatters.ts`: currency, percentage, quantity, and timestamp formatting.

`PortfolioView.tsx` should either become a thin compatibility export or be removed after `App.tsx` points to `PortfolioPage.tsx`.

### Backend and API changes

Reuse the current portfolio list, summary, transaction, contribution, trade, and intelligence endpoints. Add only the following small management capability if confirmed by the existing service invariants:

- `PATCH /portfolios/{portfolio_id}` for renaming a portfolio.

Do not add destructive portfolio deletion in this chunk. Portfolios contain an immutable transaction ledger and snapshots, so deletion needs a separate archive policy rather than a casual UI control.

Strengthen `TradeOrderRequest` validation:

- Trim and normalize symbol server-side.
- Reject non-finite quantity and price values.
- Return field-specific domain messages for insufficient cash, insufficient holdings, unknown symbol, and unavailable market price.
- Keep tenant scoping on every portfolio lookup.

### Data and control flow

1. Load portfolio summaries.
2. Resolve the active portfolio from a valid route or the first available portfolio.
3. Fetch portfolio summary and transactions in parallel.
4. Fetch contribution data only when its tab is opened.
5. Preserve the last successful summary while refreshing.
6. Open the trade drawer with an optional preselected holding symbol.
7. Validate inputs locally, submit once, then refresh summary, transactions, and contribution data.
8. Show all failures through the shared normalized error system.

### Files to modify

- `dashboard/src/App.tsx`
- `dashboard/src/api/client.ts`
- `dashboard/src/components/PortfolioView.tsx`
- `dashboard/src/index.css`
- `dashboard/src/types/platform.ts`
- `api/main.py`
- `api/core/exceptions.py`
- `api/routes/portfolios.py`
- `api/schemas/portfolio.py`
- `api/services/portfolio_service.py`
- `api/tests/test_portfolio.py`

### Files to add

- Shared error types, parser, route guards, and error-state components under `dashboard/src/api`, `dashboard/src/lib`, and `dashboard/src/components/ui`.
- Portfolio page, hook, components, formatters, and component tests under `dashboard/src/pages` and `dashboard/src/features/portfolio`.
- Backend exception-handler tests covering validation, HTTP, domain, and unexpected errors.

### Edge cases and failure handling

- No portfolios: show a compact creation state, not an empty full application shell.
- Portfolio exists but has no holdings: show one call to record a trade and one call to plan a decision.
- One holding quote fails: retain the row, mark price unavailable, and keep the rest of the portfolio usable.
- Stale selection after portfolio list changes: select the first valid portfolio.
- Double trade submission: disable submission while pending and use one mutation state.
- Insufficient cash or quantity: show the specific field or order-level message.
- Invalid portfolio route: no request is made; render a formatted recovery state.
- Authentication expiry: show a session-expired message and route through the existing sign-in flow.

### Performance considerations

- Fetch independent portfolio requests in parallel.
- Lazy-load contribution data.
- Avoid refetching the portfolio list after every trade unless portfolio-level metadata changed.
- Memoize sorted holdings and formatters.
- Abort or ignore stale selection requests when users switch portfolios quickly.

### Tests and acceptance criteria

- API client maps Pydantic validation arrays into readable field errors.
- Invalid numeric route parameters never result in `/NaN` API calls.
- Portfolio first-load, empty, partial quote, refresh, and error states render correctly.
- Trade drawer validates BUY and SELL inputs and prevents duplicate submission.
- A successful trade updates metrics, holdings, and activity.
- Keyboard and narrow-screen behaviour are verified.
- No raw JSON, object string, stack trace, or backend validation array appears in the UI.

## Chunk 2: Watchlists upgrade

### Product outcome

Watchlists become a compact monitoring workspace rather than a symbol storage list. A user can scan price state, open a symbol in Market, create an alert, or begin a decision without leaving the context of the selected watchlist.

### Target information architecture

#### Header

- Title: `Watchlists`.
- Active watchlist selector with create, rename, and delete management inside a small menu.
- One-line metadata: symbol count and quote freshness.
- Primary action: `Add Symbol`.

#### KPI strip

Show only:

1. Symbols tracked.
2. Advancing.
3. Declining.
4. Data unavailable.

These are descriptive breadth counts for the selected watchlist, not recommendations.

#### Symbol table

- Columns: symbol and company, last price, day move, compact market context, and actions.
- Market context is a short label such as `Trending up`, `Range-bound`, or `Data delayed`, with no multi-sentence explanation.
- Default sorting: manual addition order or symbol, with explicit choices for day move and price.
- Search filters the current watchlist locally.
- Row click opens Market.
- Row actions open `New Decision`, `Create Alert`, or `Remove`.
- Secondary technical detail belongs in Market, Decision, or an expandable row, not in the default table.

#### Symbol drawer

- Use ranked ticker and company-name matching from the supported NIFTY 50 catalogue.
- Prevent duplicates before submission.
- Show selected symbol, company name, exchange suffix, and one compact freshness note.
- Keep batch or multi-select addition out of this chunk unless it can be added without obscuring the primary flow.

### Backend and API changes

Add a watchlist snapshot endpoint:

- `GET /watchlists/{watchlist_id}/snapshot`

The response should contain watchlist metadata, `as_of`, provider freshness, and one row per symbol with:

- Symbol and company name.
- Current price when available.
- Absolute and percentage day change when available.
- Compact regime or context label if it can be computed from existing cached services without excessive latency.
- Per-row availability state and short reason.

The endpoint must preserve partial success. A failed quote for one symbol must not fail the complete watchlist.

Retain the current create, rename, delete, add, and remove endpoints. Normalize duplicate-symbol, invalid-symbol, default-watchlist deletion, and not-found errors into stable domain codes.

### Frontend architecture

Create:

- `pages/WatchlistsPage.tsx`.
- `features/watchlists/hooks/useWatchlistWorkspace.ts`.
- `features/watchlists/components/WatchlistHeader.tsx`.
- `features/watchlists/components/WatchlistMetrics.tsx`.
- `features/watchlists/components/WatchlistTable.tsx`.
- `features/watchlists/components/SymbolPickerDrawer.tsx`.
- `features/watchlists/components/WatchlistMenu.tsx`.

Convert `WatchlistManager.tsx` into a thin export or remove it after route migration.

### Data and control flow

1. Load watchlist summaries.
2. Resolve active watchlist from valid UI state.
3. Load its snapshot as one domain request.
4. Filter and sort rows locally.
5. After add, remove, rename, or delete, update the relevant list and refresh only the affected snapshot.
6. Preserve snapshot rows during refresh and show a small refreshing indicator.
7. Carry symbol and source query parameters into Market, Alerts, or Decision navigation.

### Files to modify

- `dashboard/src/App.tsx`
- `dashboard/src/api/client.ts`
- `dashboard/src/components/WatchlistManager.tsx`
- `dashboard/src/index.css`
- `dashboard/src/types/platform.ts`
- `api/routes/watchlists.py`
- `api/schemas/watchlist.py`
- `api/services/watchlist_service.py`
- `api/services/market_data_service.py`
- `api/tests/test_watchlist.py`

### Files to add

- Watchlist page, hook, components, response types, and tests.
- Snapshot service or focused assembler if adding the logic to `WatchlistService` would mix persistence and market-data orchestration.

### Edge cases and failure handling

- No watchlists: offer one clear create action.
- Empty watchlist: offer symbol search and explain the Market, Alert, and Decision handoffs in one short line.
- Duplicate symbol: keep the drawer open and identify the symbol-level issue.
- Unsupported symbol: suggest choosing from the ranked catalogue.
- Partial market-data failure: show `Unavailable` only on affected rows.
- Deleting the active non-default watchlist: select a remaining valid watchlist.
- Default watchlist: rename may be allowed, deletion remains unavailable with a clear reason.
- Rapid watchlist switching: stale responses cannot replace the newest selection.

### Performance considerations

- Avoid one browser request per symbol by using the snapshot endpoint.
- Let existing server caches absorb repeated quote and structure reads.
- Bound provider concurrency and preserve partial results.
- Do not calculate heavy evidence reports for every row.
- Keep client sorting and search memoized.

### Tests and acceptance criteria

- Snapshot endpoint enforces tenant ownership and returns partial results.
- Create, rename, delete, add, and remove operations preserve active selection correctly.
- Prefix-ranked symbol search is shared with Decision creation.
- Row actions produce correct Market, Alert, and Decision routes.
- Errors use shared components and never expose serialized API payloads.
- The default screen remains readable at common laptop widths without horizontal page scrolling.

## Chunk 3: Alerts upgrade and complete error migration

### Product outcome

Alerts become a readable condition-monitoring workspace. Users create conditions through normal form controls, immediately understand each alert in plain language, inspect recent evaluations when needed, and move from a triggered condition into Market or a new Decision.

This chunk also finishes the application-wide error audit so all routes and modules use the shared error contract.

### Target information architecture

#### Header

- Title: `Alerts`.
- One-line metadata: last evaluation time and on-demand evaluation disclosure.
- Primary action: `New Alert`.
- Secondary action: `Evaluate Active`.

#### KPI strip

Show only:

1. Active.
2. Triggered.
3. Paused.
4. Evaluation errors.

#### Filter bar and list

- Tabs or filter chips: Active, Triggered, Paused, and All.
- Optional symbol search.
- Each row shows symbol, a human condition summary, status, last evaluation or trigger time, and compact actions.
- Examples: `Price above ₹2,500`, `Volume above 2.0x average`, or `EMA 9 crosses above EMA 21`.
- Row actions: evaluate, pause or resume, open Market, start Decision, view history, and delete.
- Put raw condition payloads and technical evaluation details behind a development-only diagnostic view, not in the user-facing list.

#### Alert creation drawer

Replace the JSON textarea with typed controls that change by alert type:

- Price above or below: threshold.
- Percentage move: percentage, direction, and reference price.
- Volume spike: baseline multiplier.
- Pattern detected: supported pattern selector.
- Moving-average cross: fast period, slow period, and direction.

Use the shared NIFTY 50 symbol picker. Show a one-line preview of the final condition before submission. Validate all numeric relationships, including fast period less than slow period.

### Persistence and API changes

Add an immutable `AlertEvaluation` record so evaluation context survives refresh:

- ID, alert ID, evaluation timestamp, triggered boolean, observed value, short message, and data-quality status.
- Store only the compact evaluated facts required for auditability. Do not duplicate full market candle histories.
- Add the required Alembic migration and model relationship.

Add endpoints:

- `PATCH /alerts/{alert_id}` for enabled state and supported condition edits.
- `GET /alerts/{alert_id}/evaluations` with a bounded default limit.

Extend list responses with the latest evaluation summary if available. Keep full history out of the list response.

Strengthen alert schema validation with alert-type-specific checks. Invalid payloads must become field errors. The backend remains authoritative even though the frontend uses typed controls.

### Frontend architecture

Create:

- `pages/AlertsPage.tsx`.
- `features/alerts/hooks/useAlertsWorkspace.ts`.
- `features/alerts/components/AlertsHeader.tsx`.
- `features/alerts/components/AlertMetrics.tsx`.
- `features/alerts/components/AlertsTable.tsx`.
- `features/alerts/components/AlertEditorDrawer.tsx`.
- `features/alerts/components/AlertHistoryDrawer.tsx`.
- `features/alerts/conditionFormatters.ts`.
- Typed form models that map UI fields to API condition payloads without exposing JSON.

Convert `AlertsManager.tsx` into a thin export or remove it after route migration.

### Data and control flow

1. Load alerts with their latest compact evaluation status.
2. Derive KPI counts and filtered rows locally.
3. Build a typed alert payload in the editor drawer.
4. Validate locally, submit, and refresh the alert list.
5. Evaluate one alert or all active alerts.
6. Persist evaluations server-side and update the affected rows without clearing the list.
7. Fetch full evaluation history only when the history drawer opens.
8. Carry symbol and alert source context into Market and Decision routes.

### Complete application-wide error migration

Audit all frontend `catch` blocks and remove:

- Empty catches that hide failures.
- `String(error)` rendering.
- `JSON.stringify` rendering.
- Direct arbitrary exception messages without normalization.
- Route parameter parsing that can produce `NaN` requests.

Apply the shared system to:

- Authentication.
- Market data and fuzzy context.
- Decisions and amendments.
- Replay setup, session, review, and analytics.
- Portfolio Intelligence.
- Watchlists, Portfolio, Alerts, Journal, and System Health.
- Lazy-route and render failures through `AppErrorBoundary`.

For the screenshot case, `/replay-lab/NaN` or any malformed session route must show a short page-level message and `Back to Replay Lab`, with no network call and no raw validation output.

### Files to modify

- `dashboard/src/App.tsx`
- `dashboard/src/api/client.ts`
- `dashboard/src/components/AlertsManager.tsx`
- `dashboard/src/components/AuthModal.tsx`
- `dashboard/src/components/ChartPanel.tsx`
- `dashboard/src/components/SystemView.tsx`
- `dashboard/src/components/WatchlistManager.tsx`
- `dashboard/src/components/PortfolioView.tsx`
- `dashboard/src/hooks/useAuth.ts`
- `dashboard/src/hooks/useMarketData.ts`
- All Decision, Replay, and Portfolio Intelligence pages containing local error rendering or numeric route parsing.
- `dashboard/src/index.css`
- `dashboard/src/types/platform.ts`
- `api/models/alert.py`
- `api/models/__init__.py`
- `api/routes/alerts.py`
- `api/schemas/alert.py`
- `api/services/alert_service.py`
- `api/services/alert_evaluator.py`
- `api/database/session.py` if model registration requires it.
- `api/tests/test_alert_evaluator.py`

### Files to add

- Alert page, hook, components, typed condition utilities, and tests.
- Alert evaluation migration and model tests.
- API-client parser tests for every supported error envelope.
- Route-guard and shared error-component tests.

### Edge cases and failure handling

- Empty symbol or invalid catalogue symbol.
- Non-finite, zero, or negative numeric conditions.
- Invalid moving-average period relationship.
- Evaluation with unavailable or delayed market data.
- One alert failing during evaluate-all: return and display per-alert results rather than losing successful evaluations.
- Alert deleted while its history drawer is open.
- Paused alerts excluded from evaluate-all.
- Triggered alerts remain readable after page refresh.
- Network interruption during evaluation keeps the last known result and clearly labels it stale.
- Malformed routes and expired sessions use recovery states, not raw exceptions.

### Performance considerations

- Keep alert list responses compact with latest evaluation only.
- Lazy-load full evaluation history.
- Bound evaluation history length and paginate later if necessary.
- Evaluate active alerts only and avoid automatic evaluation on every render.
- Update individual rows after single-alert mutations rather than refetching unrelated data where safe.

### Tests and acceptance criteria

- Users never type or read JSON to create or understand an alert.
- Each alert type has schema, service, and UI validation coverage.
- Evaluation history persists and is tenant-scoped.
- Evaluate-all preserves partial successes and reports row-level failures.
- Pause and resume state survives refresh.
- Alert handoffs open the correct Market and Decision context.
- Every known malformed numeric route is blocked before API access.
- A repository-wide frontend search finds no user-visible `JSON.stringify(error.detail)`, `String(error)`, or empty request catch blocks.
- All error states are formatted, actionable, accessible, and free of sensitive technical details.

## Interface and compatibility decisions

- Existing endpoint paths remain valid unless explicitly extended above.
- Existing list and detail response fields remain compatible. New fields are additive.
- Alert evaluation persistence requires one forward and reversible database migration.
- Portfolio transactions remain immutable.
- Watchlist snapshots and portfolio valuations remain derived from provider data and are not copied into user-domain tables.
- The public Market dashboard and NIFTY 50 catalogue remain accessible without authentication. Portfolio, Watchlists, and Alerts remain authenticated and tenant-scoped.

## Implementation sequence inside each chunk

For each chunk:

1. Add or update backend schemas and stable error codes.
2. Add service behaviour with tenant scoping and partial-failure rules.
3. Add routes and backend tests.
4. Add or update frontend types and API methods.
5. Add the page-level hook and normalized async state.
6. Build compact UI components and responsive styling.
7. Add frontend tests for success, empty, loading, partial, and failure states.
8. Run backend tests, frontend lint, frontend tests, and production build.
9. Manually verify desktop and narrow layouts before starting the next chunk.

## Final release gate

The three-chunk upgrade is complete only when:

- Portfolio, Watchlists, and Alerts share a coherent visual hierarchy with Decision Journal.
- Each default page is crisp and scannable, with detailed information progressively disclosed.
- Cross-page actions preserve symbol, portfolio, watchlist, and source context.
- All authenticated resources remain tenant-isolated.
- No error path renders raw JSON, validation arrays, stack traces, or exception objects.
- Existing Decision, Replay, Portfolio Intelligence, authentication, and public Market flows remain functional.
- Backend tests pass.
- Frontend lint and tests pass.
- The production frontend build succeeds.
- Database migration upgrade, downgrade, and re-upgrade succeed for the new alert evaluation table.

