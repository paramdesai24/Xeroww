# 1. Executive Summary

Phase 1 changes how users enter and navigate Xeroww. Home becomes a public daily market overview, Markets becomes a discovery page, and a dedicated Stock Page becomes the common destination for charts, technical evidence, forensics, decisions, alerts, portfolio holdings, watchlists, and replay. The quantitative engines, their calculations, authentication boundaries, immutable Decision Journal, and Replay Lab remain in place.

The build is a sequence of five releasable milestones. It first establishes routes and a light/dark design system, then adds Home and search, moves the existing workstation to Stock, connects personal workspaces to Stock, and finishes with responsive and accessibility work. Legacy URLs remain valid until their replacements are proven. The planned product experience is a market portal at entry and a deep analytical workspace after choosing a company.

Phase 1 excludes new streaming infrastructure, data warehouses, and broad market intelligence. Every displayed market value must identify its source, observation time, delay, and unavailable state. The initial universe remains the supported NIFTY 50 catalogue.

# 2. Current UX Analysis (based on existing Xeroww)

| Existing experience | Evidence in repository | Phase 1 implication |
| --- | --- | --- |
| `/` and `/market` redirect to `/market/RELIANCE.NS` | `dashboard/src/App.tsx` | Add a distinct Home route and move the workstation to `/stocks/:symbol`. |
| One large `App.tsx` owns market layout, chart state, replay controls, sidebars, and modal state | `dashboard/src/App.tsx` | Extract a Stock Page container while reusing its hooks and domain components. |
| `ChartPanel` has candlesticks, S/R, EMA/SMA, crosshair, zoom controls, and workspace actions | `dashboard/src/components/ChartPanel.tsx` | Recompose controls into a coherent toolbar; retain indicator and forensic behavior. |
| Daily OHLC bars are the default and bar time is a date string | `dashboard/src/hooks/useMarketData.ts`, `api/routes/ohlc.py`, `api/services/yahoo_provider.py` | Intraday 1D/5D needs a timestamp-aware API and frontend type path before it is offered. |
| Public NIFTY 50 catalogue and bounded quote snapshot already exist | `GET /stocks`, `GET /quotes` | Reuse these for search and most discovery ranks. |
| Only the NIFTY 50 benchmark has a dedicated index history path | `api/services/yahoo_provider.py` | Four index cards need explicit provider validation and a small index summary contract. |
| Watchlist and portfolio already have compact workspaces but lead back to `/market/:symbol` | `WatchlistsPage.tsx`, `PortfolioPage.tsx` | Change their stock links and avoid duplicating analysis in those pages. |
| Portfolio metrics and an equity curve exist on separate pages | `PortfolioMetrics.tsx`, `/portfolios/{id}/equity-curve` | Bring concise visuals into Portfolio using existing snapshot and intelligence data. |
| Alerts have typed creation and history; decisions have immutable tickets | `AlertsPage.tsx`, `DecisionCreatePage.tsx` | Reuse these flows from Stock with symbol and source context. |
| CSS has useful semantic variables alongside many hardcoded dark colors | `dashboard/src/index.css`, component classes, chart options | Introduce light/dark tokens and migrate both CSS and chart styling. |
| There is no news route or source contract | `api/routes` | Show a clearly labeled five-slot preview state until an approved source is available. Do not fabricate headlines. |

The NIFTY 50 catalogue contains company metadata, including sector. It is a supported stock universe, not a complete exchange listing. Homepage watchlist preview means the first five symbols in the user's selected watchlist, since portfolio holdings are a separate domain.

# 3. Target Product Architecture

**Page ownership:** Home composes market summaries, one lightweight hero chart, news preview, and a personal watchlist preview. Markets composes discovery rankings and filters. Stock owns the full chart, technical sidebar, sessions table, forensics, and symbol-specific tabs. Watchlists, Portfolio, Alerts, Decisions, and Replay own personal workflows and link to Stock. Settings owns theme preferences and access to the existing System Health view.

**Data ownership:** The market provider and existing deterministic services remain the authority for quotes, bars, indicators, and evidence. User tables remain the authority for watchlists, paper trades, alerts, decisions, and replay sessions. Home and Markets may aggregate the same market data, but they must not persist derived user holdings or duplicate technical calculations.

**User journey:** Home search resolves a supported ticker such as `RELIANCE` to canonical `RELIANCE.NS`, then opens `/stocks/RELIANCE`. The Stock Page loads quote and chart data. Its actions prefill Decision or Alert. Holdings and watchlist rows return to the same stock route. Replay setup and review link back to Stock without changing replay's point-in-time data or rules.

**Public and private boundary:** Home, Markets, and Stock remain readable without sign-in. Watchlists, Portfolio, Alerts, Decisions, Replay, and personal Stock tabs require authentication. A signed-out Stock visitor can see public analysis and a sign-in prompt for personal actions. Personal data must never enter public market response caches.

**Presentation boundary:** The headline surfaces show a short state and a timestamp. Long explanations live in technical details, forensics, and decision evidence. Data gaps get a labeled empty state. No chart type or timeframe is shown as selectable before its data path is validated.

# 4. Route Tree

| Route | Why it exists | Visibility and key content |
| --- | --- | --- |
| `/` | Daily entry and broad market orientation | Public. Index strip, movers, flagship chart, news preview, watchlist preview. |
| `/markets` | Discover companies before opening a workstation | Public. Ranked lists, 52-week screens, sector view, search, filters. |
| `/stocks/:symbol` | Canonical home for a company | Public analysis; personal tabs and actions gated. Accept ticker without `.NS`, normalize to the supported symbol, and use one canonical URL. |
| `/watchlists` | Manage groups of tracked companies | Signed in. Compact rows and mini sparklines leading to Stock. |
| `/portfolio` | Review paper holdings and performance | Signed in. Metrics, charts, holdings, activity, and portfolio intelligence links. |
| `/alerts` | Manage on-demand condition checks | Signed in. Search, statuses, typed editing, and evaluation history. |
| `/decisions` | Review immutable decision records | Signed in. Existing `/decisions/new` and `/decisions/:id` subroutes remain. |
| `/replay` | Historical practice and behaviour review | Signed in. Existing replay setup, session, review, and analytics subroutes map beneath it. |
| `/settings` | Theme and account preferences | Signed in for account controls; System Health remains reachable at `/settings/system`. |

Primary navigation: **Home, Markets, Watchlists, Portfolio, Decisions**. The right side contains **Global Search, Alerts, Replay, theme toggle, and user menu**. The user menu exposes Settings and System Health. On narrow screens, a bottom or overflow menu keeps Home, Markets, Search, Watchlists, and Portfolio reachable. The active route, not a manually synchronized module variable, determines navigation state.

Legacy routes stay as redirects or compatibility links during migration: `/market` to `/markets`, `/market/:symbol` to `/stocks/:symbol`, `/replay-lab/*` to the equivalent `/replay/*`, and `/system` to `/settings/system`. Preserve query parameters and valid symbol context. Unknown symbols show a useful recovery state and search. Do not break bookmarked decision, portfolio intelligence, replay review, or forensics destinations.

# 5. Desktop Wireframes (ASCII)

Home, around 1440 px wide:

```text
+--------------------------------------------------------------------------------+
| Xeroww  Home  Markets  Watchlists  Portfolio  Decisions | Search | Theme | User |
+--------------------------------------------------------------------------------+
| NIFTY 50        | SENSEX         | BANKNIFTY      | INDIA VIX      | Status     |
| value  move    | value  move    | value  move    | value  move    | timestamp  |
| sparkline      | sparkline      | sparkline      | sparkline      | delay      |
+-------------------------------------------+------------------------------------+
| Flagship stock chart                      | Top Gainers / Losers / Most Active |
| RELIANCE HDFCBANK TCS INFY ICICIBANK       | compact ranked rows                |
| short chart and price context              | View all Markets                   |
+-------------------------------------------+------------------------------------+
| Market News: 5 latest or labeled empty    | My Watchlist: first 5 or sign in   |
+--------------------------------------------------------------------------------+
```

Markets:

```text
+--------------------------------------------------------------------------------+
| Search company or symbol  | Sector | Sort | Data as of | Market status         |
+----------------------+----------------------+----------------------+----------------------+
| Top Gainers          | Top Losers           | Most Active          | 52W High / Low       |
| ranked stock rows    | ranked stock rows    | value traded proxy   | distance and date    |
+----------------------+----------------------+----------------------+----------------------+
| Sector Performance: equal-weight constituent moves, clearly labeled              |
| Stock results table: company | price | move | volume | sector | open stock       |
+--------------------------------------------------------------------------------+
```

Stock Page:

```text
+--------------------------------------------------------------------------------+
| Company  NSE  price  change  timestamp | Watchlist | Alert | Decision | Share |
| Open | High | Low | Prev Close | Volume                                      |
+---------------------------------------------------------+----------------------+
| Chart type | 1D 5D 1M 3M 6M 1Y 5Y Max | indicators |  | Regime + ATR/RVOL    |
| cursor | measure | drawings | screenshot | reset         | EMA trend            |
|                                                         | Confluence           |
|                  Primary chart                          | Evidence audit       |
|             S/R and moving averages                     | Collapse             |
|                                                         |                      |
+---------------------------------------------------------+----------------------+
| Overview | Technicals | News | Decisions | Alerts | History                 |
+---------------------------------------------------------+----------------------+
| Selected tab content, concise by default                                      |
| Recent sessions: sticky header, sorting, candle expansion, Forensics         |
+--------------------------------------------------------------------------------+
```

Portfolio:

```text
+--------------------------------------------------------------------------------+
| Portfolio selector | Record Trade | Portfolio Intelligence                   |
| Total Value | Invested | Cash | Unrealized P&L                              |
+---------------------------------------+----------------------------------------+
| Equity curve                          | Allocation donut                       |
| Snapshot dates and quality            | Sector allocation                      |
+---------------------------------------+----------------------------------------+
| Daily contribution                    | Holdings table, each symbol opens Stock |
+--------------------------------------------------------------------------------+
```

# 6. Mobile Considerations

At 768 px and below, Home stacks the index cards in a two-column grid, places the flagship chart ahead of movers, and limits each list to a short preview. At phone widths, the market strip scrolls horizontally with clear snap points. Search opens a full-screen dialog with keyboard focus, results, recent searches, and a close control.

The Stock Page gives the chart full width. The technical sidebar becomes a labeled drawer; the chart toolbar scrolls horizontally and its advanced tools move into an overflow menu. The stock quote and actions wrap into two compact rows without clipping. Chart height follows viewport width with a minimum readable height. The right pane is never required to see price or chart status.

Recent Sessions becomes a compact list on phones, with tap-to-expand OHLC details and Forensics. Stock tabs remain a single horizontally scrollable tablist. Watchlist and portfolio charts use touch-sized controls and preserve readable labels. Drawers trap focus, restore it on close, and provide visible close actions. Hover-only interactions always have tap and keyboard equivalents.

No layout relies on fixed desktop widths. Respect reduced-motion settings, safe-area insets, 200% text zoom, and keyboard traversal. At tablet widths, keep the chart as the primary column and move technical evidence to a drawer before reducing chart height.

# 7. Component Hierarchy

The hierarchy indicates ownership and reuse. Proposed props are contracts, not new backend schemas.

| Component | Responsibility and principal props | Reused by |
| --- | --- | --- |
| `AppShell` | Route outlet, shared navigation, auth gate, theme; `children`, `session` | All pages |
| `TopNavbar` | Primary routes and user actions; `currentRoute`, `user`, action callbacks | All pages |
| `GlobalSearch` | Ranked symbol/company matches, keyboard navigation, recents, watchlist priority; `query`, `stocks`, `watchlistSymbols`, `onOpenSymbol` | Navbar, Home, Markets |
| `ThemeToggle` | Accessible theme selection; `theme`, `onChange` | Navbar, Settings |
| `MarketIndexCard` | Value, move, sparkline, status, as-of, quality; `index` | Home |
| `HeroChart` | Small OHLC chart and flagship switcher; `symbol`, `bars`, `quote`, `onSelect` | Home |
| `StockSwitcher` | Five flagship stock choices; `active`, `onSelect` | Home, optional Stock related navigation |
| `StockHeader` | Company, quote, OHLC summary, public and personal actions; `stock`, `quote`, `onWatchlist`, `onAlert`, `onDecision`, `onShare` | Stock, compact variant on Replay |
| `PriceBadge` | Price, change, quality, timestamp; `quote`, `size` | Stock, Markets, Watchlist |
| `MetricGrid` | Compact labeled market values; `items`, `density` | Stock, Portfolio |
| `ChartWorkspace` | Existing `ChartPanel` plus layout and tools; `symbol`, `bars`, `structure`, `selection`, `mode` | Stock, Replay design shell |
| `ChartToolbar` | Chart type, timeframe, cursor, measure, screenshot, reset; `capabilities`, `state`, `onChange` | Stock; reduced version on Home |
| `TimeframeSelector` | Only valid selectable ranges; `value`, `availability`, `onChange` | Stock, Home |
| `IndicatorSelector` | Existing S/R, EMA, SMA visibility; `enabled`, `onToggle` | Stock |
| `TechnicalSidebar` | Existing market regime, ATR, RVOL, confluence, evidence; `analysis`, `collapsed`, `onToggle` | Stock; drawer on tablet |
| `RegimeCard`, `ConfluenceCard` | Present existing engine outputs without recomputation | Stock, concise previews where useful |
| `OHLCTable`, `SessionRow` | Sticky sortable sessions, expandable row and forensics action; `bars`, `onSelect` | Stock |
| `ForensicsModal` | Visual polish for Anatomy, Pattern Engine, Structure, Lineage; `symbol`, `candle`, `tab`, `onClose` | Stock, Replay |
| `WatchlistCard`, `MiniSparkline` | Brief symbol summary and price trend; `symbol`, `quote`, `bars`, `onOpen` | Home, Watchlists |
| `PortfolioCard`, `PortfolioCharts` | Metrics and four concise portfolio visuals; `summary`, `snapshots`, `contributions` | Portfolio |
| `NewsCard` | Source, headline, time, link, or unavailability; `item` | Home, Stock News tab |
| `DecisionPreview`, `AlertPreview` | Symbol-filtered personal records and destination actions; `symbol`, `items`, `onOpen` | Stock tabs, existing list pages |

Existing `ChartPanel`, `OHLCTable`, `CandleForensicsModal`, regime/confluence cards, portfolio hooks, watchlist hooks, and Decision/Alert pages should be adapted or wrapped. They remain the sole implementations of their domain logic. Suggested file organization is `pages/HomePage.tsx`, `pages/MarketsPage.tsx`, `pages/StockPage.tsx`, `components/shell/*`, `features/market/*`, `features/stock/*`, and `design/tokens.css`; keep existing feature folders for personal workspaces.

# 8. Theme System

Use `data-theme="light"` or `data-theme="dark"` on the document root. Define a small semantic token set for both modes: `--background`, `--surface`, `--surface-2`, `--border`, `--text-primary`, `--text-secondary`, `--accent`, `--success`, `--danger`, `--warning`, and `--muted`. Extend it only where the current design requires a distinct role, such as chart grid, focus ring, price rise/fall fills, or overlay scrim.

Light mode uses white canvas, soft gray panels, blue interactive controls, dark high-contrast text, and restrained green/red financial signals. Dark mode retains charcoal layers and blue controls rather than a flat black page. Typography keeps the existing role-based hierarchy: the same font for all page titles, the same font for all section headings, consistent body and label roles, and a tabular numeric face for prices. Prices and negative changes must communicate meaning through text or icons as well as color.

`ThemeProvider` reads a saved user preference, otherwise follows system preference. The toggle writes local storage immediately; Settings exposes light, dark, and system. Server-side persistence is optional and must not block Phase 1. A pre-render bootstrap applies the saved theme before React mounts to avoid a flash. Existing CSS variables in `index.css` can be mapped to the new semantic names during migration. Remove hardcoded dark Tailwind classes, hex colors in component markup, and chart canvas constants as each page migrates. Chart options should read resolved token values when created and update via the chart API on theme change.

Document contrast targets, focus visibility, muted text legibility, chart grid visibility, and semantic color tests in both themes. Include TradingView attribution in the chart area or another public location as required by the [Lightweight Charts license guidance](https://tradingview.github.io/lightweight-charts/docs/5.0).

# 9. TradingView Integration Strategy

Xeroww uses `lightweight-charts` 5.2.1. Its official [series documentation](https://tradingview.github.io/lightweight-charts/docs/series-types) supports candlestick, bar, line, area, baseline, and histogram series. Series are not converted in place; the chart adapter should remove the old primary series, create the selected series, preserve the visible range where possible, and reattach overlays, markers, and selected-candle handling.

| Requested chart type | Plan and support |
| --- | --- |
| Candlestick | Built in and already used. Keep as default. |
| Hollow Candles | No built-in hollow series is listed. Use a custom series renderer or a tested plugin; keep it out of the initial selector until body, wick, hit testing, and theme contrast work. |
| Line | Built-in line series using close values. |
| Area | Built-in area series using close values. |
| Baseline | Built-in baseline series with a visible reference value, defaulting to previous close or a user-selected base. |
| Heikin Ashi | Feasible as a deterministic display transform of OHLC bars into derived candles. Label it synthetic and never pass transformed bars into existing evidence, alerts, decisions, forensics, or replay calculations. |

The [chart API](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi) provides screenshot capture; the [crosshair API](https://tradingview.github.io/lightweight-charts/docs/api/enumerations/CrosshairMode) provides normal, magnet, and hidden modes; the time-scale API provides visible-range and fit controls. Implement crosshair, pointer cursor, screenshot, and reset zoom in the toolbar. A measure tool needs custom pointer state and a canvas/series primitive to show price and time deltas. Full drawing tools are not included in core Lightweight Charts; provide disabled or clearly labeled planned controls until working implementations are available. Official [plugin documentation](https://tradingview.github.io/lightweight-charts/docs/plugins/intro) and [examples](https://tradingview.github.io/lightweight-charts/plugin-examples/) offer primitives and trend-line/rectangle references, but editable drawing persistence is separate work.

Timeframes map to explicit data contracts:

| UI range | Bars | Data requirement |
| --- | --- | --- |
| 1D, 5D | Intraday, such as 15-minute bars | Add timestamp-preserving OHLC response and validate provider availability, timezone, and delay. |
| 1M, 3M, 6M, 1Y | Daily bars | Reuse `/ohlc/{symbol}` with the matching period. |
| 5Y, Max | Daily or sampled daily bars | Validate history depth, loading cost, and responsive chart performance before enabling. |

Current `YahooFinanceProvider.get_ohlc` formats every bar as a date, so it cannot represent multiple intraday candles on the same day. The provider and OHLC schema need a compatible timestamp field or interval-aware time representation. The [yfinance source documentation](https://github.com/ranaroussi/yfinance/blob/main/yfinance/scrapers/history.py) lists these periods and intervals and states that intraday history is limited to recent data. Map unsupported combinations to disabled UI, not silent daily substitutes. Fetch by `(symbol, range, interval)` with request cancellation or generation guards; retain the previous valid chart while loading. Respect current Yahoo delay and provider rate limits.

The stock toolbar is two-tier on wide screens: chart type/timeframe/indicators first, cursor/measure/drawings/screenshot/reset in a compact utility group. S/R and MA overlays stay sourced from the current deterministic analysis. A viewport resize must not reset the user's range or force a new market request. Preserve the chart's TradingView attribution.

# 10. Reusable State Architecture

Use React Router as the source of truth for route and canonical symbol. A `StockWorkspaceProvider` owns per-stock presentation state: timeframe, chart type, indicators, selected candle, active Stock tab, and collapsed sidebar. It may encode shareable choices in query parameters, but transient cursor and drawer state stay local. `ChartWorkspace` talks to this provider rather than passing every setting through `StockPage`.

Use a small `ThemeProvider` for light/dark/system and a `GlobalSearchProvider` for open state and recent searches. Search uses the current `searchSymbols` ranking function as its base, adding watchlist-priority tie breaking and a bounded recent list in local storage. Never treat arbitrary regex syntax as a user command; escape input as the existing matcher does. Fetch the public catalogue once, then filter locally for instant results. Enter opens the highlighted canonical stock; Escape closes; arrows and Home/End move through options; focus returns to the search trigger.

Reuse existing `api/client.ts`, `useMarketData`, `useWatchlistWorkspace`, and `usePortfolioWorkspace`. Factor a shared market-query cache keyed by symbol, period, interval, and data type, using the existing server cache and bounded frontend cache rather than issuing the same quote and OHLC requests from Home, Markets, and Stock. Apply distinct freshness windows for quotes, daily candles, and the static catalogue. Guard against stale results after rapid stock switching, preserve available partial data, and show per-widget retry. Personal watchlist cache keys include the authenticated user identity and are cleared on sign-out. Avoid broad global stores for route-local chart interactions.

Replay keeps its own historical session state and point-in-time evidence. It shares Stock visual components and chart adapter, but a replay session must never read future live bars into historical analysis.

# 11. Backend Impact

**Existing endpoints reused:** `GET /stocks` supplies the supported company catalogue and sectors. `GET /quotes?symbols=...` supplies a bounded snapshot for movers and stock rows; `GET /quote/{symbol}` supplies Stock header data. `GET /ohlc/{symbol}` supplies daily charts and mini sparklines. Existing market structure, pattern, forensics, fuzzy, and breadth endpoints feed the Stock sidebar and technical tabs. Existing watchlist, portfolio summary, contribution, portfolio snapshots/equity curve/attribution, alerts, decisions, and replay endpoints remain the authenticated source of personal data.

**New endpoints required:**

1. A small, cacheable `GET /markets/indices` contract for NIFTY 50, SENSEX, BANKNIFTY, and India VIX, each with value, change, compact sparkline, source timestamp, freshness, and market-status confidence. Validate provider symbols and access first; return an unavailable card when a symbol cannot be sourced. Existing benchmark history covers only NIFTY 50, so this cannot be claimed as already present.
2. Extend `GET /ohlc/{symbol}` or add a versioned intraday variant to return unambiguous exchange-time timestamps for 1D/5D. Add strict period/interval validation and bound response size. Preserve the current daily-bar format for existing callers during migration.
3. A cacheable `GET /markets/discovery` aggregate for 52-week proximity and sector summaries, with per-item availability and as-of. Build it only after testing a bounded server-side batch of one-year bars; avoid 50 extra browser requests per visit. Gainers, losers, and most active can be ranked from the existing quote snapshot if that data is complete enough.

**Optional endpoints:** `GET /news?limit=5&symbol=...` after a source, usage rights, attribution, and freshness policy are selected; a personal `GET /me/preferences` for cross-device theme settings; and a batched compact sparkline endpoint if individual OHLC requests become costly. Until news is approved, Home and Stock News show an intentional placeholder with no fabricated items.

Ranking definitions must be explicit. Gainers and losers use daily percentage change among available NIFTY 50 quotes. "Most Active" uses an estimated traded-value proxy (`price × volume`) and is labeled as such, since current quote data does not expose exchange turnover ranking. Sector performance is an equal-weight mean of available constituent percentage moves, with coverage count and delayed status; it is not an official sector index. A 52-week high or low uses a rolling year of daily high/low bars and requires coverage checks. Market open/closed status requires an exchange calendar and timezone-aware clock; if the calendar is unavailable, show "status unavailable" rather than infer from stale quotes.

# 12. Migration Plan

1. Add a route inventory and compatibility tests for every current URL. Extract `AppShell` and route-based page composition from `App.tsx`, then add tokenized light/dark themes. Keep old market rendering reachable until Stock is accepted.
2. Add Home and Markets as new pages using existing catalogue and quote data. Add Global Search and hero stock switching. Introduce the index and discovery contracts behind graceful unavailable states. Publish Home without changing personal workspaces.
3. Extract the market workstation from `App.tsx` into `StockPage` and `ChartWorkspace`. Move, rather than duplicate, chart, sidebar, X-Ray, sessions, and forensics state. Add stock-specific tabs, responsive sidebar, toolbar, chart types, and validated timeframe choices. Keep legacy market paths redirecting to the new route.
4. Change Watchlists, Portfolio, Alerts, Decision, and Replay links to the canonical Stock route. Add mini sparklines and concise portfolio charts using existing data. Preserve authenticated gating, tenant scoping, immutable tickets, and replay point-in-time semantics. Retire duplicated stock analytics from list pages after parity checks.
5. Finish accessibility, responsive behavior, theme coverage, visual regression, loading/error states, and performance budgets. Remove the old Market screen implementation only after all route and workflow tests pass. Keep a legacy URL redirect for bookmarks.

Each milestone is independently deployable. Prefer additive API changes and component moves over schema changes. Validate public and signed-in flows in both themes at desktop, tablet, and phone widths. Keep migration flags or compatibility wrappers temporary and remove them once the new routes are stable.

# 13. Milestone Timeline

| Milestone | Suggested duration | Exit gate |
| --- | --- | --- |
| 1. Shell, navbar, theme, routing | 4 to 6 engineering days | Home and old flows route correctly; theme persists; both themes pass contrast and smoke checks. |
| 2. Home, search, market cards | 5 to 8 days | Flagship chart switches instantly; search works by keyboard; every index/news gap has an honest state. |
| 3. Stock Page and advanced chart | 8 to 12 days | Existing forensics and technical outputs match the old page; chart types and validated timeframes work; Stock is usable on tablet. |
| 4. Personal workspace integration | 5 to 7 days | All watchlist, portfolio, alert, decision, and replay links reach the correct Stock context; charts use existing portfolio data. |
| 5. Polish and retirement | 4 to 6 days | Accessibility, responsive, route, visual, performance, and legacy-link checks pass; duplicate Market screen removed. |

Total planning range: about 26 to 39 engineering days for one experienced engineer, with provider validation and visual review as the main uncertainty. These are sequencing estimates, not a release date. If index access, news rights, or intraday history is unavailable, ship the milestone with labeled unavailable states and keep those controls disabled until the data contract is real.

# 14. Technical Risks

| Risk | Mitigation |
| --- | --- |
| Yahoo data is delayed, rate limited, or unavailable for some indices | Server-side bounded fetching, cache, partial responses, per-card timestamps, and explicit unavailable states. |
| Current daily date-only bar format collapses intraday candles | Add an interval-aware timestamp type and test chart ordering, timezone, DST handling, and old daily callers. |
| Broad 52-week and sparkline fetching causes request bursts | Aggregate and cache on the server, share frontend market queries, cap concurrency, and defer hidden charts. |
| Chart type switching loses S/R, markers, selection, or visible range | Central chart adapter with explicit overlay lifecycle and interaction regression tests. |
| Synthetic Heikin Ashi could contaminate deterministic evidence | Display-only transform; original OHLC remains the sole input to engines, forensics, decisions, alerts, and replay. |
| Light theme exposes hardcoded dark classes and chart colors | Token migration by page, theme snapshots, contrast audit, and chart option updates on toggle. |
| Large `App.tsx` extraction disrupts replay or forensics | Move one bounded slice at a time, retain old route redirects, and compare evidence outputs before removing old rendering. |
| Portfolio equity curve is sparse without captured snapshots | Show actual observation points, coverage, and a clear insufficient-history state; never interpolate as real performance. |
| Stock tabs accidentally expose another user's records | Fetch personal tabs only after authentication, filter and verify on the server, clear user-scoped caches on logout. |
| News data lacks source or usage rights | Keep a labeled placeholder until source, license, publication time, and attribution are agreed. |
| "TradingView-grade" expectation exceeds Lightweight Charts core tools | Deliver documented native capabilities first and mark custom drawing/measurement work explicitly; do not present placeholders as working tools. |

# 15. Definition of Done

- `/` is a useful public Home page. `/markets` is discovery. Every supported stock opens a canonical `/stocks/:symbol` page from global search, Home, Markets, Watchlists, Portfolio, Alerts, and Decision context.
- The Stock Page retains all existing S/R, EMA/SMA, RVOL, ATR, regime, confluence, recent-session, replay, diff, X-Ray, forensics, and evidence behavior. Forensics tabs retain Anatomy, Pattern Engine, Structure, and Lineage.
- Stock tabs provide Overview, Technicals, News, Decisions, Alerts, and History without duplicating domain logic. Signed-out users never receive personal records.
- The chart supports the verified built-in types and only enabled timeframes with valid bars. Synthetic types and custom tools are labeled accurately. Screenshot, crosshair, reset zoom, and indicator selection work on desktop and touch-capable layouts.
- Home shows four index cards, movers, a switchable five-stock hero chart, a five-item news area or labeled unavailable state, and a five-symbol watchlist preview or sign-in state. All market values include observation time and delay/quality context.
- Markets provides searchable and filterable NIFTY 50 discovery, with truthful mover, 52-week, and sector definitions and graceful partial data.
- Portfolio shows total value, invested value, cash, unrealized P&L, an equity curve, allocation donut, sector allocation, and daily contribution using real available observations. Holdings link to Stock.
- Watchlist rows include mini sparklines and route to Stock; Alerts, Decisions, and Replay preserve their existing functional workflows and link to Stock where relevant.
- Light and dark themes cover the entire app, including charts, modals, forensics, errors, and authenticated pages. No user-facing surface depends on hardcoded dark-only colors.
- Public and private route tests, legacy redirects, symbol normalization, keyboard search, chart controls, tenant isolation, decision immutability, replay point-in-time behavior, responsive layouts, accessibility, frontend build, and backend tests pass.
- The old Market screen has been removed after parity validation; legacy market URLs still resolve to the new Stock or Markets route.
