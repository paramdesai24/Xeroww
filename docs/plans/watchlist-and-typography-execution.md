# Watchlist and typography execution plan

## Architecture

Apply `version-free-ui-and-typography-plan.md` and Chunk 2 of `portfolio-watchlists-alerts-experience-plan.md` together. Keep Watchlist ownership and symbol persistence in `WatchlistService`. Add a snapshot assembler that reads owned watchlist items, enriches each from the existing cached market data service, and returns partial results when providers fail. The UI uses a route-level workspace with one state hook, small display components, and the shared error primitives. Shared typography roles live in CSS variables and classes, with matching chart and SVG mappings where CSS cannot apply.

## Interfaces and data flow

`GET /watchlists/{watchlist_id}/snapshot` requires authentication and returns watchlist metadata, an `as_of` timestamp, provider note, and rows in addition order. Each row has symbol, company, nullable price/change/change percent, quote timestamp, a short factual context label, availability, and nullable reason. It must never imply a recommendation. The route loads ownership-scoped items first, then enriches quotes with bounded concurrency. A per-symbol failure creates an unavailable row without failing the request. An unknown or foreign watchlist remains 404.

The UI loads summaries, resolves an active ID, then loads one snapshot. Switching IDs ignores stale responses. Local search and sort never call the backend. Add/remove/rename/create/delete operations show a pending state, preserve the previous snapshot on failed requests, and refresh only the affected data after success. Market row selection navigates to `/market/{symbol}`. Decision handoff navigates to `/decisions/new?symbol={symbol}&source=WATCHLIST`; Alert handoff navigates to `/alerts?symbol={symbol}`.

## Modules and controls

- Backend: `api/schemas/watchlist.py`, `api/routes/watchlists.py`, new `api/services/watchlist_snapshot_service.py`, and `api/tests/test_watchlist.py`.
- Frontend API: `dashboard/src/types/platform.ts`, `dashboard/src/api/client.ts`.
- Frontend workspace: new `dashboard/src/features/watchlists/hooks/useWatchlistWorkspace.ts`, `dashboard/src/pages/WatchlistsPage.tsx`, and compact components for metrics, rows, and symbol picker. Replace `WatchlistManager.tsx` with a compatibility export and keep `App.tsx` route wiring.
- Display: `dashboard/src/index.css` and existing shared typography files. Implement title, section, card, body, control, label, metadata, data, and metric roles. Remove arbitrary tiny sizes from the main workspaces, controls, tables, and error states. Keep body text distinct from tabular financial data.
- Release copy: remove product release labels from navbar, module navigation, footer, auth modal, Decision Journal, System, legacy decision notice, API health/root metadata, and stale source comments. Preserve technical schema and concurrency versions.

The Watchlist header holds selection and a compact management menu. The default viewport has four breadth counts, search and sort controls, and a table of factual quote evidence. The add-symbol picker uses the existing ranked NIFTY 50 search. Removal and deletion require confirmation. A contextual evidence detail may expand within the row; no long evidence paragraphs appear by default.

## Edge cases and performance

Handle zero watchlists, an empty selected list, duplicate symbols, invalid or unsupported symbols, one or all unavailable quotes, deleted active list, expired auth, and rapid list switching. Limit quote concurrency to avoid provider bursts. Use existing quote cache; do not fetch candles for every watchlist row. Freshness is based on quote timestamps and must not claim live exchange data. Provide keyboard access to row actions, dialog close, and the picker. Keep informative text when color is used for movement.

## Implementation order and tests

1. Add snapshot schema, assembler, route, and tenant/partial-result tests.
2. Add frontend response type and client method. Build the state hook with stale-response protection and mutation handling.
3. Build the compact workspace, picker, management controls, sorting/filtering, and three handoffs. Verify empty and partial data states.
4. Apply semantic typography tokens and roles to shared UI, all page headers, data tables, cards, dialogs, chart labels, and System topology text.
5. Remove visible release identifiers and update affected API and frontend contracts. Audit remaining matches in source and classify necessary technical versions.
6. Run backend lint and focused tests, frontend lint/tests/build, then visually check every module at desktop and narrow widths, 200% zoom, and long labels.

Success means every route shares the same hierarchy for the same text role, the Watchlist remains useful with one quote failure, all actions work without raw errors, and no Xeroww release number appears in the application or public metadata.
