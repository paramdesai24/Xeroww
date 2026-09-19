# Xeroww Dashboard Branding, Responsiveness, Typography, and Yahoo Data Repair Plan

## Objective

Repair the currently visible dashboard so that the supplied Xeroww brand assets appear in the live navigation, the market workspace remains usable at desktop, tablet, and mobile widths, the typography feels contemporary and readable, and local API traffic reaches FastAPI and Yahoo Finance reliably.

The work must preserve the existing black and white visual identity, existing financial features, deterministic analytics, route contracts, and authentication behavior.

## Confirmed Root Causes

### Logo missing from the live dashboard

The supplied assets exist at `dashboard/public/xeroww-logo.png` and `dashboard/public/xeroww-logo-long.png`. They were integrated into `Navbar.tsx`, but `App.tsx` renders `ModuleNav.tsx`. `ModuleNav.tsx` still renders a plain text `Xeroww` label, so the logo change cannot appear in the running dashboard.

### Bad Gateway before requests reach FastAPI

The Vite development proxy targets `http://localhost:8000`. On this Windows environment, Node resolves `localhost` to IPv6 `::1`. FastAPI was started on IPv4 `127.0.0.1`, so Vite receives `ECONNREFUSED ::1:8000` and returns `Bad Gateway`. This failure happens before any request reaches yfinance.

### yfinance local cache failure after the proxy is repaired

A direct request to FastAPI reaches the backend but yfinance raises `sqlite3.OperationalError: unable to open database file`. The installed yfinance version uses a Peewee backed local timezone and cookie cache. Its default cache location is not writable in the current execution environment. Xeroww must explicitly configure a writable cache directory before creating or calling any ticker.

### Responsive layout limitations

The market screen is a fixed three-pane flex layout:

- Left watchlist is always 224 pixels wide.
- Right analytics panel is always 360 to 380 pixels wide.
- The center chart receives only the remaining width.
- The navigation uses a single fixed-height row containing brand, tabs, breadth, spacer, and session controls.
- The root uses `h-screen` and globally prevents overflow, so narrow layouts cannot stack and scroll safely.
- The footer assumes one horizontal line and can crowd or clip at smaller widths.

At approximately 1000 pixels wide, the side panels consume most of the viewport, leaving an undersized chart and forcing navigation controls to overflow.

### Typography limitations

The current typography imports Public Sans and JetBrains Mono from Google Fonts. Much of the interface uses 10 to 12 pixel text, frequent bold weights, uppercase mono labels, and hardcoded legacy color and font classes. This produces a dense, old terminal-like appearance rather than a modern analytical workspace. The remote font import can also flash or fall back when network access is restricted.

## Architecture and Design Decisions

### Branding strategy

`ModuleNav` will be the single live top-level branding surface.

- Use the full horizontal logo where enough width exists.
- Use the compact square X asset at narrow widths.
- Preserve each image's intrinsic aspect ratio with `width: auto`, `object-fit: contain`, and fixed maximum height instead of forcing both dimensions.
- Keep the version badge beside the mark on desktop and tablet.
- Retain accessible `alt="Xeroww"` text.
- Keep the existing PNG assets and favicon integration. No new raster generation is required.
- Do not add the unused `Navbar` component to the render tree. Its health functionality is already represented by `Footer` and other system UI.

### Responsive workspace strategy

Use three explicit layout modes with semantic CSS classes instead of scattering many arbitrary utility widths through the component tree.

#### Desktop, 1280 pixels and wider

- Keep the current three-pane mental model.
- Use a 224 pixel watchlist, a flexible chart column, and a 360 to 380 pixel analytics panel.
- Preserve full navigation controls and full horizontal logo.
- Keep body overflow contained within each panel.

#### Tablet and compact desktop, 768 through 1279 pixels

- Convert the watchlist into a horizontal asset rail spanning the workspace width.
- Keep the chart and analytics area in two columns.
- Reduce analytics width to a bounded responsive value near 300 to 340 pixels.
- Allow the module tabs to scroll horizontally without shrinking labels.
- Use the compact logo when the full lockup would compete with navigation.
- Keep quote controls horizontally scrollable or selectively hide low-priority labels while preserving every action.

#### Mobile, below 768 pixels

- Use a single scrollable column.
- Keep the horizontal watchlist rail near the top.
- Give the chart a practical minimum height so it remains usable.
- Place the analytics panel below the chart as a full-width section.
- Allow the recent sessions table to scroll horizontally rather than compressing numeric columns.
- Make navigation a brand and action row followed by a horizontally scrollable module row.
- Collapse or hide nonessential footer prose while retaining provider, engine status, and version.
- Use `100dvh` with a `100vh` fallback to avoid mobile browser chrome sizing errors.

### Typography strategy

Adopt a calmer, contemporary hierarchy while preserving the distinction between prose and financial numbers.

- Use `Inter` as the primary UI family because it is neutral, modern, and highly legible at compact sizes.
- Use `IBM Plex Mono` for prices, percentages, timestamps, and technical identifiers. Its shapes are less stylized than JetBrains Mono and better match a premium financial product.
- Keep local system fallbacks so the UI remains readable if the remote font request fails.
- Raise the default body size from approximately 11 pixels to 13 pixels.
- Use 12 pixels only for metadata and secondary labels, and reserve 10 to 11 pixels for compact badges.
- Reduce unnecessary bold styling. Use weight 600 for headings, 500 for interactive labels, and 400 for descriptive copy.
- Avoid broad uppercase labels and wide tracking except for short technical badges.
- Apply tabular numerals to financial values and keep them in the mono family.
- Improve line height to 1.45 to 1.55 for readable descriptions while keeping numeric rows compact.

### Yahoo data strategy

The development proxy and yfinance cache are separate layers and both must be fixed.

1. Point the Vite proxy to `http://127.0.0.1:8000` so it matches the backend listener and does not depend on localhost address-family selection.
2. Add a configurable `YFINANCE_CACHE_DIR` setting.
3. Default the yfinance cache to a writable temporary directory such as the operating system temp directory under `xeroww-yfinance`, rather than a user profile or repository location.
4. Create that directory before the provider is used.
5. Call yfinance's cache location configuration once, before any `Ticker` access.
6. If the configured cache directory cannot be created, raise a clear provider initialization error that names the directory and original filesystem error.
7. Preserve current provider abstraction, symbol normalization, cache service behavior, API routes, and response schemas.

## Files and Modules to Change

### `dashboard/src/components/ModuleNav.tsx`

- Replace the hardcoded brand text with responsive compact and long logo images.
- Add semantic class names for the nav shell, brand block, module scroller, breadth action, and session block.
- Preserve all existing callbacks and module identifiers.
- Add suitable `aria-label` or title text where compact layouts hide visible labels.
- Keep the version badge and session state behavior unchanged.

### `dashboard/src/App.tsx`

- Add semantic classes to the application root, market workspace, center column, and analytics panel.
- Replace fixed right-panel Tailwind widths with CSS-controlled responsive dimensions.
- Preserve component order and all market, replay, X-Ray, modal, and authentication state.
- Ensure mobile stacking changes only presentation, not data flow or conditional rendering.

### `dashboard/src/components/Sidebar.tsx`

- Add semantic classes to the watchlist shell, header, list, rows, and footer strip.
- Support the desktop vertical list and responsive horizontal asset rail using CSS.
- Make each horizontal quote row retain a safe minimum width.
- Preserve quote fetching per stock, active selection, price coloring, and loading states.

### `dashboard/src/components/ChartPanel.tsx`

- Add semantic classes to the quote bar and its primary, statistics, overlay, and intelligence control groups.
- Allow low-priority statistics to hide at narrower widths.
- Allow essential controls to scroll horizontally instead of wrapping into an unusable header.
- Adjust chart control positioning for narrow screens.
- Preserve chart initialization, series updates, selection, replay, X-Ray, forensics, zoom, and overlay behavior.

### `dashboard/src/components/OHLCTable.tsx`

- Allow the table container to scroll horizontally on narrow screens.
- Keep date and numeric columns at usable minimum widths.
- Shorten or conditionally hide explanatory header text on small screens.
- Preserve row selection and compact or expanded behavior.

### `dashboard/src/components/Footer.tsx`

- Add semantic classes for responsive grouping.
- Keep provider, engine status, database status, and version visible on desktop.
- Prioritize engine status and version on mobile and hide lower-priority prose.
- Avoid text wrapping that increases the fixed footer height unexpectedly.

### `dashboard/src/index.css`

- Replace the current font imports and family tokens with Inter and IBM Plex Mono.
- Update the global typography scale, weights, line heights, and rendering defaults.
- Add semantic responsive layout rules for navigation, market workspace, watchlist rail, analytics panel, table, and footer.
- Add `min-width: 0` to grid and flex children where needed to prevent overflow.
- Add `100dvh` support and mobile body scrolling within the app shell.
- Keep existing color tokens, black surfaces, blue accent, semantic green and red, and motion limits.

### `dashboard/src/design/typography.ts`

- Align exported tokens with the implemented Inter and IBM Plex Mono families.
- Raise body and data sizes to the revised hierarchy.
- Reduce excessive tracking values and document when mono and uppercase treatments are appropriate.

### `dashboard/tailwind.config.js`

- Update Tailwind font family extensions to match the CSS tokens.
- Preserve existing token mappings and utility behavior.

### `dashboard/vite.config.ts`

- Change the development proxy target from `localhost` to `127.0.0.1`.
- Keep `/api` rewrite and change-origin behavior unchanged.
- Set strict port behavior only if needed for predictable local URLs. Otherwise retain automatic fallback to the next port.

### `api/core/config.py`

- Add `YFINANCE_CACHE_DIR` as an environment-driven setting.
- Default it to a writable temp directory rather than the user profile.
- Keep the setting as a string or path-safe value consistent with the existing settings class.

### `api/services/yahoo_provider.py`

- Add one idempotent cache setup helper.
- Ensure the directory exists and configure yfinance before any ticker method is called.
- Invoke setup during provider initialization or module-level provider setup, with a preference for constructor initialization so failures are explicit and testable.
- Preserve all quote and OHLC calculations and public provider methods.
- Improve unexpected cache initialization errors so the API reports a provider configuration problem instead of a misleading generic quote failure.

### `api/.env.example` and root `.env.example`

- Document `YFINANCE_CACHE_DIR` as an optional override.
- Explain that the default uses a writable temporary directory.

### Tests

- Add or extend frontend tests for the navigation brand rendering and responsive hooks where DOM behavior is testable.
- Add a backend provider test for cache configuration using a temporary directory and monkeypatched yfinance cache setter.
- Add a backend test for a clear failure when cache directory creation fails.
- Do not make tests depend on live Yahoo Finance network responses.

## Components, Functions, and Interfaces

### Existing interfaces retained

- `ModuleNav` props remain unchanged.
- `SidebarProps` remains unchanged.
- `ChartPanel` props remain unchanged.
- `MarketDataProvider` remains unchanged.
- REST paths and response schemas remain unchanged.
- The frontend API base path remains `/api` by default.

### New internal helper

Add a private yfinance cache setup function with this responsibility:

- Read `settings.YFINANCE_CACHE_DIR`.
- Convert it to a `Path`.
- Create parent directories with idempotent semantics.
- Pass the resolved directory to `yf.set_tz_cache_location`.
- Record completion so repeated provider construction does not perform redundant work.
- Raise a meaningful runtime error if setup fails.

No public API is required for this helper.

## Data Flow and Control Flow

### Dashboard startup

1. React renders `App`.
2. `App` renders `ModuleNav`, the market workspace, and `Footer`.
3. `ModuleNav` selects the full or compact logo through CSS breakpoints without JavaScript viewport listeners.
4. The same market components are laid out using CSS grid areas for desktop, tablet, or mobile.
5. `useMarketData` requests `/api/stocks`, quote, OHLC, patterns, and structure data as before.
6. Vite rewrites `/api/...` to the matching FastAPI IPv4 listener.

### Backend market request

1. FastAPI receives the route request.
2. `MarketDataService` checks Xeroww's Redis or memory cache.
3. On a cache miss, `YahooFinanceProvider` has already configured a writable yfinance cache directory.
4. yfinance loads its timezone and cookie cache and calls Yahoo Finance.
5. Xeroww normalizes and caches the provider response.
6. The frontend receives typed data and populates the chart and analytics panels.

## Error Handling

- Vite proxy errors should disappear once address families match.
- A backend that is genuinely stopped should still surface as a clear frontend offline or fetch error.
- An unwritable explicit `YFINANCE_CACHE_DIR` must produce a clear provider setup error with no silent fallback to another hidden directory.
- A reachable yfinance provider returning no quote or OHLC data should retain the existing 503 behavior.
- Invalid symbols must retain the existing 404 behavior.
- Responsive changes must not hide market errors, authentication prompts, replay controls, or health status.
- Missing logo assets should retain meaningful alternative text and must not prevent navigation from rendering.

## Edge Cases

- Very narrow widths around 320 pixels.
- Browser zoom at 125 and 150 percent.
- Long user display names and roles.
- Horizontal module navigation with every tab present.
- Empty watchlist, loading watchlist, and provider failure states.
- Large currency values and negative percentages.
- Expanded recent sessions table on a narrow viewport.
- Analytics tabs in replay mode, where the extra Events tab appears.
- X-Ray drawer overlay on mobile.
- Mobile browser URL bars changing viewport height.
- Remote fonts blocked or slow.
- Backend launched on IPv4 only.
- yfinance cache override pointing to a missing but creatable directory.
- yfinance cache override pointing to an invalid or read-only path.
- Redis unavailable, which must continue falling back to the in-memory cache.

## Performance Considerations

- Use CSS media queries rather than JavaScript resize listeners to avoid render churn.
- Keep the existing chart `ResizeObserver` behavior and ensure its container has stable dimensions.
- Preserve lazy loading for non-market modules and modals.
- Do not duplicate market API requests when the layout changes.
- Configure yfinance cache only once per process.
- Continue using browser image decoding and intrinsic image dimensions to avoid layout shift.
- Avoid adding new runtime UI dependencies.

## Testing and Verification

### Static and automated checks

1. Run `npm run lint` in `dashboard`.
2. Run `npm run test:run` in `dashboard`.
3. Run `npm run build` in `dashboard`.
4. Run targeted backend provider and API tests.
5. Run the full backend pytest suite if targeted tests pass.

### API verification

1. Start FastAPI on `127.0.0.1:8000`.
2. Start Vite and confirm `/api/health` returns 200 through the browser origin.
3. Confirm `/api/stocks` returns the five-stock watchlist.
4. Confirm `/api/quote/RELIANCE.NS` and `/api/ohlc/RELIANCE.NS` reach the provider without the SQLite cache error.
5. If Yahoo itself is unavailable, verify Xeroww returns a specific 503 rather than a proxy Bad Gateway or cache-path 500.

### Visual verification

Test these representative viewports in the in-app browser:

- 1440 by 900: full logo and three-pane workspace.
- 1024 by 768: compact logo or constrained lockup, horizontal watchlist, chart plus analytics.
- 768 by 1024: tablet transition with no clipped controls.
- 390 by 844: one-column mobile layout with usable chart, analytics below, and horizontal navigation.
- 320 by 568: minimum supported width with no page-level horizontal overflow except intentional rails and tables.

At each viewport verify:

- Logo is visible, sharp enough, and not distorted.
- Navigation remains operable.
- Chart receives meaningful width and height.
- Every analytics tab is reachable.
- Footer does not overlap content.
- Typography is readable and restrained.
- Loading, success, and error states fit their containers.

## Step-by-Step Implementation Instructions

1. Update `vite.config.ts` to use the IPv4 FastAPI target.
2. Add `YFINANCE_CACHE_DIR` to backend configuration and environment examples.
3. Add and test the yfinance cache setup helper before any provider request is executed.
4. Replace the `ModuleNav` brand text with the two supplied responsive logo assets.
5. Add stable semantic class names to `ModuleNav`, `App`, `Sidebar`, `ChartPanel`, `OHLCTable`, and `Footer`.
6. Implement desktop, tablet, and mobile layout rules in `index.css` using the specified breakpoints.
7. Update the UI and mono font imports, CSS variables, Tailwind families, and exported typography tokens.
8. Normalize the most visible navigation, quote-bar, analytics-heading, table, and footer sizes and weights.
9. Add targeted tests for brand rendering and yfinance cache setup.
10. Run lint, frontend tests, frontend build, targeted backend tests, and the full backend suite.
11. Restart both development servers so proxy and backend configuration changes take effect.
12. Verify API health and market endpoints through the Vite origin.
13. Open the app in the in-app browser and inspect all representative viewport sizes.
14. Correct any clipping, overlap, inaccessible controls, or aspect-ratio distortion discovered during visual verification.

## Completion Criteria

- The live dashboard visibly uses the supplied Xeroww logo.
- The long and compact assets switch appropriately without distortion.
- The market workspace is usable at desktop, tablet, and mobile widths.
- Typography feels contemporary, readable, and restrained while financial values remain precise.
- Vite no longer produces `ECONNREFUSED ::1:8000`.
- yfinance can initialize its local cache in a writable location.
- Market requests either return data or a truthful provider-specific 503, never the current misleading Bad Gateway caused by the local proxy.
- Existing financial analytics, authentication, replay, X-Ray, and module navigation behavior remain intact.
- Automated checks and visual verification pass.
