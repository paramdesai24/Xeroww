# Market navigation and layout repair plan

## Scope and outcome

Repair the chart toolbar, market quote header, Watchlist handoffs, Replay and Portfolio detail routing, and the market data failure shown in the supplied log. The visible result should be a compact market workspace whose controls have the same neutral treatment, whose selected stock remains selected, and whose data failures explain what the user can do next.

## Findings from the current code

1. `ChartPanel.tsx` gives each chart control a different background, border, color, padding, and font weight. The Plan Decision control is visually unboxed. The control row can scroll horizontally without any visible overflow cue.
2. The Dr. Reddy's header is constrained by `quote-bar__asset` and `quote-bar__price` minimum widths plus a three-column stats grid sized with `max-content`. At the supplied width, the stats can extend outside the chart column.
3. Watchlist Market and Decision actions construct symbol-specific URLs in `WatchlistsPage.tsx`. Decision creation reads the symbol query parameter. Market selection is fragile because `App.tsx` syncs the URL to `useMarketData()` state in an effect while the Market sidebar directly changes state without updating the URL. The async market fetch has no stale-response guard.
4. `ReplayLabPage.tsx`, `ReplayReviewPage.tsx`, and `PortfolioIntelligencePage.tsx` call `useParams()`, while `App.tsx` selects their components with pathname regular expressions. The root only renders `<App />` inside `<BrowserRouter>`, so no matching `<Route>` supplies those params. Valid detail links can therefore show the invalid-link screens in screenshots 2 and 3.
5. The log shows temporary Yahoo DNS/crumb failures and 503s, followed by a burst of `GET /quote/{symbol}` calls and 429 responses from Xeroww. `Sidebar.tsx` mounts one fetch per stock, for up to 50 stocks, every time the Market view mounts. `useMarketData()` also starts market requests while the app is on another module. The API rate limit is 600 unauthenticated requests per minute; increasing that number alone would not reduce provider traffic.
6. A 429 message is currently passed to `ChartPanel` as an ordinary chart error. The UI does not distinguish a temporary request limit from unavailable provider data. Existing quote and candle caches can help, but the client still issues redundant HTTP requests.

## Architecture and decisions

### 1. Use matched routes for detail pages

Keep the existing application shell and authentication gate. Replace the pathname-only Replay and Portfolio detail switches inside `App.tsx` with nested `<Routes>` and explicit `<Route>` patterns for the existing URLs. Match `/replay-lab/:sessionId`, `/replay-lab/:sessionId/review`, and `/portfolio/:portfolioId/:view`. Keep list, setup, analytics, and portfolio landing routes explicit. Use a scoped fallback for unknown paths. `useParams()` then receives the ID from React Router. Preserve `parsePositiveIntParam` as validation for manually entered or malformed links; a nonpositive or nonsensical ID should still show a useful error state. Do not redirect valid detail links to the list.

### 2. Make the Market URL the selected-symbol authority

For `/market/:symbol`, derive and validate the symbol from the route. Market sidebar selections and every Market handoff navigate to `/market/<encoded symbol>`. Pass the routed symbol into the market data hook, or otherwise ensure there is only one selected-symbol source. Stop data work when Market is not active. On a symbol change, clear or label old quote and candle data while the new stock loads, and ignore late responses from the previous symbol. Keep `/` redirected to the default market symbol. Reuse the same symbol normalization used by the stock universe so encoded symbols such as `M%26M.NS` work.

### 3. Reduce quote request volume at the source

Add a bounded public quote snapshot endpoint for the supported universe, returning each requested symbol with either a normalized quote or an unavailable state, plus a snapshot timestamp and data-source note. Cap the request to the supported 50 symbols, deduplicate symbols, and use the existing `MarketDataService` cache and provider. Reuse the partial-failure pattern in `watchlist_snapshot_service.py` without requiring authentication for the public Market sidebar. Do not return invented prices for unavailable quotes. Limit provider concurrency and, if needed, briefly cache an unavailable result to avoid immediate repeat storms during DNS failures.

Replace the 50 `QuoteRow` network effects in `Sidebar.tsx` with one snapshot request from a parent hook. Reuse a recent snapshot across route changes for a short, explicit freshness window, and provide an intentional refresh. Keep the selected chart's quote and OHLC requests independent so a sidebar partial failure cannot blank a working chart. Count the expected HTTP requests for Market open, module switch, and return; the normal flow must stay comfortably below the existing 600 RPM limit. Retain the API limiter and `Retry-After` header.

### 4. Give market failures specific recovery states

Use the structured API error from `api/errors.ts` to distinguish 429, 503, and network failure. A 429 should say that requests are temporarily limited, honor `Retry-After` for a retry countdown or disabled retry button, and retain any already loaded chart instead of discarding it. A 503 should indicate that the market feed is temporarily unavailable and expose a retry action. When only quote or only OHLC is unavailable, show the available portion with an accurate note. A missing candle series must never display stale bars under a new symbol. Keep provider diagnostics in logs and show concise user-facing copy.

### 5. One neutral control system and a contained quote header

Create one chart-toolbar button style in `index.css` and apply it to S/R, EMA, SMA, Plan Decision, Replay, Diff, X-Ray, and Forensics. Give each actionable button a visible box, equal height, consistent horizontal padding, border, radius, type role, and focus indicator. Use the same neutral color treatment across the buttons. Use `aria-pressed` and a neutral selected treatment such as a heavier border or neutral fill for toggle state; tool labels stay outside button boxes. Group spacing should be deliberate and the toolbar should wrap or present an obvious horizontal scroll affordance when space is tight.

Rework `quote-bar__identity` with flexible grid or wrapping tracks. The symbol and company name may truncate within their own bounded area; the price and day change must remain readable. Move previous close, day range, and volume onto a second row or hide lower-priority figures at defined widths. Do not let stats make the chart wider than its container. Check long symbols, large prices, 125-200% zoom, and the Dr. Reddy's example.

## Files and interfaces

- `dashboard/src/App.tsx`: route definitions, Market symbol navigation, active-module data gating.
- `dashboard/src/hooks/useMarketData.ts`: route-driven symbol, stale request handling, partial quote/OHLC state, refresh behavior.
- `dashboard/src/components/Sidebar.tsx`: parent-owned quote snapshot; no per-row fetch effect.
- `dashboard/src/components/ChartPanel.tsx`: shared control class, toggle semantics, quote header markup if needed, error and retry UI.
- `dashboard/src/index.css`: toolbar tokens, responsive quote header layout, visible overflow affordance.
- `dashboard/src/pages/WatchlistsPage.tsx`, `dashboard/src/features/watchlists/components/WatchlistTable.tsx`: verify Market, Decision, Alert URLs and symbol encoding; change only if the route contract requires it.
- `dashboard/src/pages/ReplayLabPage.tsx`, `ReplayReviewPage.tsx`, `PortfolioIntelligencePage.tsx`: retain validated IDs and ensure real routes supply them.
- `dashboard/src/api/client.ts`, `dashboard/src/api/errors.ts`, `dashboard/src/types/market.ts`: batch snapshot contract and rate-limit metadata.
- `api/routes/quote.py` or a dedicated adjacent market route, `api/schemas/quote.py`, `api/services/market_data_service.py`: bounded public quote snapshot with partial results, cache reuse, error classification.
- `api/core/rate_limit.py`: preserve limits; expose standard retry information if the client needs a stable field beyond `Retry-After`.

Proposed public interface: `GET /quotes?symbols=RELIANCE.NS,TCS.NS`. The response contains `as_of`, `data_note`, and a `rows` array with `symbol`, `quote` or `null`, and a safe unavailability reason. Validate and cap input before provider calls. The single-symbol `/quote/{symbol}` contract stays available for the chart and other consumers.

## Control flow

1. Opening a Watchlist loads its own snapshot. Market action navigates to the encoded Market URL; Decision action opens the draft with its symbol and `WATCHLIST` source; Alert action opens the alert composer with its symbol.
2. The Market route resolves the symbol, requests quote/OHLC for that symbol, and presents its bars. The sidebar reads a single cached quote snapshot. Clicking another sidebar stock changes the URL, which triggers a fresh chart request and discards stale responses.
3. A Replay or Portfolio detail link matches its React Router route. The page receives the numeric parameter, requests its actual record, then renders the detail or a record-specific error. A malformed URL uses the invalid-link state.
4. During provider failure, each snapshot row can be unavailable independently. A limited request uses the server's retry interval. The chart retains valid data only when it belongs to the current symbol.

## Edge cases and performance

- Support direct reloads and browser Back/Forward on Market, Replay, and Portfolio detail URLs.
- Handle symbols with URL-sensitive characters, empty symbols, removed constituents, and malformed numeric IDs without a 422 request or a crash.
- Handle partial sidebar quote failures, all quotes unavailable, delayed data, and a quote that succeeds while OHLC fails.
- Avoid duplicate initial fetches from development Strict Mode by request deduplication or an abortable shared request, without hiding real errors.
- Bound parallel provider calls and keep a short cache TTL. Confirm that navigating among tabs does not refetch all 50 quotes each time.
- Keep keyboard focus visible and make control toggle state accessible to assistive technology.

## Implementation sequence

1. Add matched detail routes and verify valid replay and portfolio URLs render their real records.
2. Make the Market route the symbol source, update sidebar selection to navigate, and guard against stale quote/OHLC responses.
3. Add the bounded quote snapshot API and change the Market sidebar to consume it. Verify partial-failure behavior and request counts.
4. Introduce rate-limit and provider-failure recovery in the market hook and chart panel.
5. Consolidate toolbar control styles and fix quote-header containment at desktop, tablet, narrow viewport, and browser zoom sizes.
6. Verify Watchlist Market, Decision, and Alert handoffs end to end, including direct reload and Back/Forward.

## Verification and acceptance

- Frontend route tests open valid Replay and Portfolio links, invalid numeric links, Watchlist handoffs, and a Market symbol change. The chart receives only the selected stock's OHLC bars after quick successive selections.
- API tests cover quote snapshot input validation, 50-symbol bound, deduplication, partial provider failure, cached results, and rate-limit response metadata.
- Compare request counts in the browser network panel before and after. Opening Market must not create one quote request per sidebar row, and leaving Market must not keep fetching market data.
- Confirm a 429 shows a short retry message and honors the server interval; a 503 shows provider unavailability; previously loaded data cannot be mislabeled as current for another symbol.
- Visually check the exact supplied examples: toolbar boxes and padding, valid Replay and Portfolio detail screens, rate-limit error state, and Dr. Reddy's quote header without clipping or horizontal page overflow.
- Run focused frontend and backend tests, frontend lint and build, and relevant backend checks. Record any pre-existing repository-wide lint failures separately from files changed by this work.
