# Version-free application and consistent typography plan

## Objective and scope

Remove Xeroww release numbers from every user-visible surface and standardize typography by semantic role across the application. Page titles should share one treatment, section headings another, body text another, and numeric market data a purposeful data treatment. The result should feel coherent across Market, Watchlists, Portfolio, Replay Lab, Alerts, Decisions, System, and all nested views without making every text element use the same font or size.

This document is an implementation plan only. No application code is changed by this planning pass.

## Evidence and design decisions

- Carbon's product typography guidance uses named type tokens and a compact productive type set to establish hierarchy in dense interfaces. Its role and layout based approach fits Xeroww's workstation layout. Source: https://carbondesignsystem.com/elements/typography/overview/
- The IBM type scale treats size and line height as a related system instead of independent per component values. Source: https://www.ibm.com/design/language/typography/type-scale/
- USWDS emphasizes readable typesetting and controlled line length for prose. Source: https://designsystem.digital.gov/components/typography/
- WCAG 2.2 requires that user-applied text spacing and text enlargement do not cause loss of content or functionality. The specified spacing values are a test condition, not required default styles. Sources: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing and https://www.w3.org/WAI/WCAG22/Understanding/resize-text

The proposed type families remain Inter for interface language and IBM Plex Mono for prices, quantities, timestamps, identifiers, and other data that benefits from aligned figures. The consistency requirement applies to roles, weight, line height, spacing, and hierarchy. Use tabular numerals for comparable numbers and avoid using mono for paragraphs or general headings.

## Audit findings

### Release numbers and version references

| Surface | Current source | Required change |
| --- | --- | --- |
| Main navigation badge | `dashboard/src/components/ModuleNav.tsx` reads `config.app.version` | Remove badge, import, and related spacing. |
| Alternate navbar badge | `dashboard/src/components/Navbar.tsx` reads `config.app.version` | Remove badge and unused import. |
| Status footer | `dashboard/src/components/Footer.tsx` reads `config.app.version` | Remove version and redundant separator; keep operational status. |
| Decision Journal eyebrow | `dashboard/src/pages/DecisionsPage.tsx` contains a release-labelled Decision Workbench heading | Replace with a timeless section label. |
| System console badge | `dashboard/src/components/SystemView.tsx` contains a release-labelled SRE console heading | Replace with `System operations` or remove if redundant. |
| Authentication modal footer | `dashboard/src/components/AuthModal.tsx` contains a release-labelled product name | Remove the release label while preserving the simulation disclaimer. |
| Legacy decision notice | `dashboard/src/pages/DecisionDetailPage.tsx` labels older entries by product release | Explain the actual condition: this older entry may lack an analytical snapshot. Keep the `ticket_version` condition. |
| Frontend configuration | `dashboard/src/config.ts` defines `app.version` with `VITE_APP_VERSION` | Remove UI release configuration after all readers are removed. |
| API health payload | `api/routes/health.py` returns `version` | Remove release field and update `dashboard/src/types/market.ts` plus contract tests. |
| API root payload | `api/main.py` returns `version` | Remove public release field and update any tests or consumers. |
| API docs and startup | `api/main.py` sets FastAPI `version=settings.APP_VERSION` and prints version | Remove release branding from startup and public OpenAPI metadata. Check FastAPI's implicit default and set a neutral API description or blank version only if supported cleanly. |
| Internal release setting | `api/core/config.py` defines `APP_VERSION` | Remove after its runtime uses are gone. |
| API error copy | `api/services/decision_service.py` and `api/services/journal_service.py` mention a product release | Replace with current behavior based copy, preserving error codes and status codes. |
| Client annotation payload | `dashboard/src/components/JournalView.tsx` sends a release-labelled client identifier | Replace with a stable client identifier; verify server treats it as an opaque string. |
| Source comments and docstrings | `dashboard/src/App.tsx`, `dashboard/src/api/client.ts`, `dashboard/src/index.css`, multiple API modules | Replace release-history comments with feature or domain descriptions; put historical context in nonserved documentation if useful. |

Perform a final repository-wide audit, including static assets, HTML, environment examples, scripts, and templates. Search separately for numbered product release labels, release configuration keys, and literal `version` uses. Review each match in context.

Keep technical version identifiers that are necessary for dependency resolution, migrations, persisted data, concurrency, or analytical provenance. This includes package and lockfile versions, Docker image tags, Alembic revisions, `expected_version`, `ticket_version`, `schema_version`, formula or scoring versions, and domain event versions. These are data contracts, not release labels. Do not delete or rename them solely for copy cleanup. If one appears in the UI, remove only its presentation unless the user needs that provenance to evaluate a result. Preserve any such provenance in an opt-in technical detail view rather than a primary card.

Documentation under `docs/`, root `README.md`, and `database/README.md` may retain historical version references, provided those files are never rendered inside the application. Update screenshots or examples in documentation only when they inaccurately claim that a release badge still appears.

### Typography sources and inconsistencies

- `dashboard/src/design/typography.ts` defines a token object but no application component consumes it. It lacks roles for page titles, section headings, and large metrics.
- `dashboard/src/index.css` contains multiple page-specific scales: portfolio labels reach 8 to 10 px, Decision Journal body copy is 12 to 13 px, and System uses separate Tailwind sizes. The same role therefore looks different across routes.
- `dashboard/tailwind.config.js` repeats font family choices while many TSX components use arbitrary `text-[...]`, `font-mono`, or inline `fontFamily` values.
- `dashboard/src/App.css` contains Vite starter styling and is not imported by `main.tsx`; confirm it is unused, then delete it during implementation.
- Chart labels use chart-library font settings in `dashboard/src/components/ChartPanel.tsx`; System topology labels set SVG font sizes and families in `SystemView.tsx`. These need mapped roles rather than a blanket CSS override.
- Market terminal, Watchlists, Alerts, and System do not use the shared `decision-page__header` and `workspace-header` pattern consistently. Shared page and panel headers should set the same hierarchy across these routes.

## Target typography system

Use role names in CSS and a matching TypeScript token map for canvas or SVG libraries. Prefer `rem` for text sizes so browser text settings and zoom work. The values below are initial specifications and should be checked visually at desktop and mobile widths before they are finalized.

| Role | Family | Size / line height | Weight | Use |
| --- | --- | --- | --- | --- |
| Page title | Inter | 28 / 34 px desktop; 24 / 30 px narrow | 600 | One title per page or full-screen overlay. |
| Section heading | Inter | 18 / 24 px | 600 | Main content sections and major panels. |
| Card heading | Inter | 16 / 22 px | 600 | Cards, drawers, dialogs, and secondary panels. |
| Body | Inter | 14 / 21 px | 400 | Explanations, descriptions, errors, and form help. |
| Control and table text | Inter | 13 / 19 px | 400 or 500 | Navigation, buttons, inputs, table content. |
| Label | Inter | 12 / 17 px | 600 | Field labels, column labels, eyebrow text; uppercase only where useful. |
| Metadata | Inter | 12 / 17 px | 400 | Dates, source notes, secondary status. |
| Data | IBM Plex Mono | 14 / 20 px | 500 | Prices, quantities, percentages, scores, codes. |
| Major metric | IBM Plex Mono | 24 / 30 px | 600 | The primary figure within a metric card. |

Rules:

1. Heading levels describe document structure. A page uses one `h1`; major sections use `h2`; nested cards use `h3` when semantically appropriate. Styling roles must not depend on heading tag alone.
2. Keep page titles in sentence or title case, not forced uppercase. Use consistent optical weight and tracking; only the page title may use slight negative tracking.
3. Keep normal body copy at 14 px or larger. Reserve 12 px for short labels and metadata; remove 8 to 10 px explanatory text. Dense tables may use 13 px if it remains readable.
4. Use tabular figures for financial numbers and right align comparable numeric table columns. Do not use monospace for general UI prose.
5. Maintain contrast across primary, secondary, and muted text. Check muted metadata on the black background before adopting a token.
6. Long explanations should have a readable maximum measure. Tables, toolbars, charts, and dashboard grids are exempt from prose line length limits.
7. At 200% browser zoom and with WCAG text spacing overrides, labels and headings must wrap or reflow without clipping. Fixed height controls may need minimum heights instead.

## Architecture and interfaces

Create one source of truth for role values in `dashboard/src/design/typography.ts`. Export semantic role definitions and derive CSS custom properties or generate a small `typography.css` from the same values. If a generation step would complicate the build, make CSS custom properties the source of truth and have the TypeScript module reference their names for DOM components; retain explicit matching numeric values only where a chart or SVG API requires numbers. Add a development check that flags drift between those exceptional numeric values and the CSS specification.

Define reusable role classes such as `.type-page-title`, `.type-section-title`, `.type-card-title`, `.type-body`, `.type-control`, `.type-label`, `.type-meta`, `.type-data`, and `.type-metric`. Shared header components should apply these roles. Tailwind should use the same CSS variables for its font family and extended font size names, allowing existing utility-heavy components to migrate without a second scale.

Add shared `PageHeader` and `PanelHeader` styling or extend the existing `dashboard/src/components/ui/PanelHeader.tsx` so pages can use a single title, eyebrow, description, and action layout. Preserve route-specific controls and content density. For chart and topology libraries, map `fontFamily` and `fontSize` options to the same roles through the design module.

The version cleanup changes only public presentation and release metadata. It must not change database schemas, migration history, optimistic locking, calculations, replay determinism, or data provenance identifiers.

## Files and migration groups

### Group 1: Version cleanup

- UI chrome: `dashboard/src/components/ModuleNav.tsx`, `Navbar.tsx`, `Footer.tsx`, `AuthModal.tsx`, `SystemView.tsx`.
- Decision copy: `dashboard/src/pages/DecisionsPage.tsx`, `DecisionDetailPage.tsx`.
- Frontend config and types: `dashboard/src/config.ts`, `dashboard/src/types/market.ts`, `dashboard/src/components/JournalView.tsx`.
- Backend public metadata and messages: `api/main.py`, `api/routes/health.py`, `api/core/config.py`, `api/services/decision_service.py`, `api/services/journal_service.py`.
- Source comments in `dashboard/src` and `api`: replace release markers where they describe current behavior. Preserve migration filenames and domain schema fields.
- Tests: health and root response contract tests, UI shell tests, and any snapshot or copy assertions. Search all tests for old badge and message expectations.

### Group 2: Token and shared component foundation

- `dashboard/src/design/typography.ts`, `dashboard/src/design/index.ts`: define semantic roles and library mappings.
- `dashboard/src/index.css`: define role classes and CSS variables; remove duplicate role definitions and unnecessary page-specific overrides.
- `dashboard/tailwind.config.js`: extend semantic font sizes and align family tokens.
- `dashboard/src/components/ui/PanelHeader.tsx` and related shared UI components (`Metric`, `Table`, `Badge`, `Feedback`, `Price`): consume the role scale.
- `dashboard/src/App.css`: remove after confirming no import or runtime use.

### Group 3: Page migration

- Decisions and Replay: `dashboard/src/pages/Decision*.tsx`, `Replay*.tsx`, `dashboard/src/components/EvidenceAnalysisOverlay.tsx`, `ReplayControlBar.tsx`, and replay components.
- Portfolio and intelligence: `dashboard/src/components/PortfolioView.tsx`, `dashboard/src/features/portfolio/**`, `dashboard/src/pages/PortfolioIntelligencePage.tsx`.
- Market, Watchlists, Alerts: `dashboard/src/App.tsx`, `dashboard/src/components/Sidebar.tsx`, `ChartPanel.tsx`, `WatchlistManager.tsx`, `AlertsManager.tsx`, market analysis cards, X-Ray panels, and modal views.
- System: `dashboard/src/components/SystemView.tsx`, including SVG and topology text.
- Shell and remaining shared surfaces: `ModuleNav.tsx`, `Navbar.tsx`, `Footer.tsx`, authentication, notifications, errors, empty states, and not-found page.

For each page, identify the semantic role of each text element before replacing its styles. Keep one compact summary per card. Avoid adding explanatory copy solely to fill a typography role.

## Data and control flow

1. App shell renders shared navigation, active route, and status footer without reading an app release number.
2. Health polling still reads operational status and provider details. The API omits the public release field, and the frontend type follows the new payload.
3. Page components choose semantic typography roles. CSS variables resolve the role to family, size, weight, line height, and tracking. Shared components use those same roles.
4. Chart and SVG configuration pulls role mappings from the design module, avoiding freehand font declarations.
5. Domain version fields continue to travel through APIs where needed for concurrency and evidence, but routine page copy does not display release identifiers.

## Edge cases, errors, and performance

- If removing a version badge changes header width, verify the navigation still fits at narrow desktop and mobile sizes and that overflow remains usable.
- A client may still receive an older cached health response with `version`; tolerate extra fields until caches expire. A newer response without `version` must not break old frontend code after coordinated deployment.
- OpenAPI tooling may emit a default API version if FastAPI receives none. Inspect generated `/openapi.json` before deciding how to suppress visible release metadata without invalidating the schema.
- Existing records with `ticket_version === 0` still trigger the legacy data quality warning, now worded by the actual missing snapshot condition.
- Charts and canvas text are outside normal CSS inheritance. Verify font loading before chart creation and preserve legible fallback families.
- Browser font loading should not block initial rendering. Keep current fallback stacks and avoid adding more font families or weights.
- Long symbols, company names, translated text, large numbers, and validation errors must wrap or truncate with a way to reveal the full content.
- A release-like string inside a user-created note or imported market data is user content and must not be rewritten.

## Step-by-step implementation

1. Record a baseline screen inventory at desktop and narrow widths for the app shell and each route. Capture the current computed typography for one example of every role.
2. Run scoped repository searches and classify every `vN.N` and `version` match as release label, internal technical contract, dependency pin, documentation, or user data. Update the audit table if new visible cases appear.
3. Remove release labels and release metadata from UI and public API responses. Update frontend types, imports, messages, and contract tests in the same change.
4. Define the semantic type scale and role classes. Reconcile the existing unused TypeScript typography module, CSS variables, and Tailwind configuration into the chosen single-source approach.
5. Update shared UI primitives and page header patterns first. Confirm the new scale in one representative dense route and one narrative route before migrating all pages.
6. Migrate each page group, replacing arbitrary text sizes and inline font choices according to the element's role. Review chart and SVG text separately.
7. Remove obsolete page-specific font declarations and unused starter CSS. Keep layout rules and deliberate domain color semantics.
8. Run static searches again for release labels and arbitrary typography declarations. Document only justified exceptions such as chart APIs or true data values.
9. Verify all routes visually at desktop, mobile, 200% zoom, and with text spacing overrides. Check title hierarchy, table legibility, modal clipping, focus states, and loading or error views.
10. Run frontend lint, tests, and production build; backend lint and relevant API tests. Complete a manual smoke pass for health, decisions, replay, portfolio, and market data flows.

## Acceptance criteria

- No Xeroww release number appears in app chrome, page content, system console, auth modal, health response, root response, or public OpenAPI metadata. Historical release notes remain in nonserved documentation.
- All page titles, section headings, card headings, body text, labels, metadata, and financial data follow their named role across routes. Deliberate family differences follow the role mapping.
- No explanatory body copy is rendered at 8 to 10 px. Dense data remains scannable and number columns align.
- No content or controls are lost at 200% zoom or under WCAG text spacing overrides.
- Existing API and domain concurrency behavior is unchanged. Existing decision and replay records still load.
- CI quality gates pass, and representative screenshots show consistent hierarchy across every module.
