# Market workspace density and resizable panes plan

## Outcome and scope

Restore the Market chart to roughly its earlier desktop height while keeping the quote, key stats, overlays, and workspace actions available. Give Workspace actions a consistent Dodger blue treatment. Make the Watchlist, center chart area, and analytics sidebar adjustable with drag handles, individually collapsible, and easy to reopen. Keep transitions smooth without making the chart blurry or causing needless data reloads. This is a frontend layout change; no API or database contract changes are required.

## Current implementation and problem

- `dashboard/src/App.tsx` renders `Sidebar`, a center column containing `ReplayControlBar`, `ChartPanel`, and `OHLCTable`, and an analytics `<aside>` directly inside `.market-workspace`.
- `dashboard/src/index.css` fixes desktop columns at `14rem minmax(0, 1fr) minmax(22.5rem, 24vw)`. At widths below 1280px, Watchlist becomes a 72px horizontal strip above the center and analytics panes. Below 768px, all three stack vertically.
- `ChartPanel.tsx` currently renders quote identity and stats in two rows, followed by controls that wrap into separate Chart Layers and Workspace rows. At the supplied desktop size, that consumes a substantial portion of the center column height. `OHLCTable.tsx` takes up to 12rem in compact mode, leaving the chart visibly short.
- All `quote-bar__control` buttons are neutral. The new color requirement applies to Workspace actions only; Chart Layers remain neutral.
- The candlestick chart already observes its container with `ResizeObserver`. The resize feature should reuse that path and avoid recreating the chart while a pane is dragged or temporarily closed.
- Existing working-tree edits from the prior Market repair are in progress. Implementation must preserve them and make this change on top of the current files.

## Architecture and technical decisions

### Compact quote and action area

Use a two-band desktop header with a stable height target of about 96 to 112px at the default pane width, instead of the current multi-row stack. Band one holds symbol, company name, price, day change, and a compact inline strip for previous close, day range, and volume when space permits. Band two holds Chart Layers and Workspace actions on one non-wrapping rail. Reduce excess padding and inter-group gaps without shrinking buttons below a usable pointer target. Keep the existing type roles and semantic hierarchy.

The layout must respond to **center pane width**, not only viewport width, because the user can narrow the center while the browser remains wide. Use container queries on the center or quote bar, with CSS fallback if needed. At intermediate pane widths, shorten or collapse lower-priority stats behind a clearly labeled `More quote details` disclosure. At narrow widths, allow the controls rail to scroll horizontally with visible overflow cues and keyboard access, or move lower-priority actions into a labeled overflow menu. Do not wrap controls into a third header row or silently clip buttons. Keep symbol and price readable, truncate only the company name or secondary values, and avoid a page-level horizontal scrollbar.

Add a Workspace-specific button class or data attribute in `ChartPanel.tsx`. Use the existing Dodger blue token (`--accent-primary`, currently `#1E90FF`) for border, text, and subtle tinted background. Provide distinguishable hover, focus, pressed, and disabled states; contrast must remain clear against the dark theme. Retain neutral styling for S/R, EMA, and SMA controls. Keep `aria-pressed` on toggles such as X-Ray.

Do not reduce the chart itself to make the header fit. With `OHLCTable` in compact mode, the default desktop layout should return the recovered vertical space to the chart. Preserve the table's current expand/collapse behavior. If a rare short viewport cannot fit header, chart, and table comfortably, allow the existing table to stay independently scrollable rather than forcing the header to wrap repeatedly.

### Pane sizing and collapse model

Introduce a `useMarketPaneLayout` hook as the single owner of pane widths, collapsed flags, active drag state, and reset behavior. Use two vertical splitters, one between Watchlist and center, one between center and analytics. Dragging the left splitter adjusts Watchlist width and therefore center width; dragging the right adjusts analytics width and center width. This gives all three sections adjustable widths without a redundant third control. Do not add vertical resizing of the Recent Sessions table in this change.

Default desktop sizes should match the current visual balance: approximately 224px Watchlist, a flexible center, and a right pane around 24vw with a 360px minimum at wide desktop widths. Use a narrow visible splitter, about 6px, with a larger invisible pointer target. Set practical minimums of roughly 180px for an open Watchlist, 440px for an open center, and 280px for an open analytics pane. Clamp widths to the available container width and preserve the center minimum before accepting a drag. When the browser becomes too narrow to satisfy all minimums, switch to the existing compact layout instead of allowing overlap.

Each pane gets a compact, labeled collapse control in its existing header: Watchlist header, center quote header, and analytics tab header. A collapsed pane becomes a slim rail with its name and an obvious reopen button. Closing the center hides chart and table visually but keeps the chart component mounted so its zoom, selected candle, and overlays survive reopening. The chart's `ResizeObserver` should skip zero-sized measurements and resize when the center opens again. All collapsed rails remain reachable; if every pane is closed, a `Reset layout` action is still visible so the page cannot become a dead end. Reopening a pane restores its last usable width, subject to current viewport constraints. A pane may not be collapsed accidentally by dragging below its minimum; collapse is an explicit action.

Use CSS grid tracks driven by validated layout state. The center is the flexible track when open. If it is closed, one other open pane becomes flexible, avoiding a wide empty column. Render splitters only between relevant open panes; do not show a draggable separator against a collapsed rail. The hook should expose typed pane identifiers (`watchlist`, `center`, `analytics`) and actions such as `togglePane`, `resizePane`, and `resetLayout`; it should not know market symbols or data.

Persist desktop widths and collapsed flags in a versioned localStorage key. Read once on mount, validate finite numbers and known flags, clamp to the current container, and use defaults on invalid or unavailable storage. Persist after a drag ends and after collapse/reset, not on every pointer move. Layout settings are browser-local and must not change URL, market selection, or server state.

### Input, motion, and responsive behavior

Implement splitters with native Pointer Events and pointer capture. Apply drag measurements relative to the Market workspace bounding box, schedule visual updates with `requestAnimationFrame`, and cancel or finish cleanly on pointer up, pointer cancel, Escape, unmount, and window resize. While dragging, disable width transitions so the splitter follows the pointer exactly; while collapsing or reopening, animate tracks and opacity over about 180 to 220ms. Respect `prefers-reduced-motion: reduce` and avoid animating the candle canvas itself.

Splitters must be keyboard operable: `role="separator"`, vertical orientation, accessible name describing the adjacent panes, `aria-valuemin/max/now`, Arrow keys for 10px adjustments, and Shift+Arrow for larger adjustments. Use visible focus styling. Collapse and reopen controls need clear accessible names and `aria-expanded` or equivalent state. Keep focus on a logical reopen control when the focused pane is collapsed.

At desktop widths where three columns can meet minimums, enable dragging and persistence. Below that breakpoint, retain the current Watchlist horizontal strip and center/analytics layout, but adapt their collapse controls to the available arrangement. On mobile, keep the stacked layout and use section disclosure behavior rather than vertical drag handles. Persisted desktop sizes should not distort tablet or phone layouts; they resume when returning to desktop. Center-width container queries must still prevent header wrapping as side panes are resized.

## Files, components, and interfaces

- `dashboard/src/App.tsx`: place the Market-specific panes inside a small workspace layout component or integrate the hook here; add splitters, collapse rails, and reset affordance without changing route or market data ownership. Keep Replay and analytics tab state intact.
- `dashboard/src/components/ChartPanel.tsx`: compact quote markup, Workspace-only button class, center collapse control slot/callback, and zero-size-safe chart resizing. Do not alter quote or OHLC data contracts.
- `dashboard/src/components/Sidebar.tsx`: accept a collapse callback or header action slot. Preserve quote snapshot caching, selected symbol behavior, and list scroll position while adjusting pane width.
- `dashboard/src/components/OHLCTable.tsx`: no feature change expected; verify that the compact table does not force center overflow and that its expanded state survives pane resizing.
- `dashboard/src/components/MarketResizeHandle.tsx` (new): accessible pointer and keyboard splitter. Keep it presentational, with width bounds and callbacks passed by the layout owner.
- `dashboard/src/hooks/useMarketPaneLayout.ts` (new): typed layout state, storage validation, drag and collapse actions, resize clamping, and reset to defaults.
- `dashboard/src/index.css`: dynamic desktop grid, collapsed rail and splitter visuals, compact quote bands, container queries, Workspace blue states, transitions, reduced-motion, and responsive overrides. Remove conflicting fixed `shrink-0` or fixed column rules only where they prevent resizing.
- `dashboard/src/App.routes.test.tsx` or a dedicated `MarketWorkspace.test.tsx`, plus a hook test: layout, keyboard, collapse/reopen, persistence, and market-state continuity. Use existing Vitest and Testing Library setup.

The only public component-interface additions should be optional layout callbacks or header-action slots. No REST endpoint, schema, migration, or backend dependency is needed. Prefer existing React, CSS, Pointer Events, `ResizeObserver`, and `lucide-react`; do not add a resize-layout package unless native handling proves insufficient during implementation.

## Data and control flow

1. Opening Market resolves the selected symbol and loads market data exactly as it does now. Separately, layout state loads validated browser-local preferences and computes desktop grid tracks.
2. Dragging a splitter changes only pane width state. `ChartPanel` stays mounted, receives new container dimensions through `ResizeObserver`, and keeps its current series, zoom, overlays, and selected candle. No quote or OHLC request is triggered by a width change.
3. Closing a pane switches its track to a rail and leaves a reopen control. Reopening restores the stored width after clamping. If the center is closed, its chart instance stays mounted but ignores zero dimensions until reopened.
4. Changing symbols, entering Replay, switching analytics tabs, or opening a Workspace action continues through existing handlers. Layout state remains independent of these flows.
5. At tablet and mobile breakpoints, the desktop width values are ignored for rendering but retained for later desktop use. Collapse controls follow the responsive arrangement.

## Edge cases, errors, and performance

- Clamp saved or dragged widths after viewport resize, browser zoom, or sidebar reopen. Never produce negative, `NaN`, or zero chart canvas dimensions while the pane is open.
- Handle long company names, large prices, long day ranges, 125 to 200% browser zoom, and translated or larger system text without clipping actionable controls.
- A closed Watchlist must not stop the center chart from working; a closed analytics pane must not change the selected tab; a closed center must not lose chart/replay state.
- Preserve an obvious way to reopen any pane, including the all-closed state and keyboard-only use.
- Treat unavailable localStorage as a harmless fallback to defaults. Never let corrupt saved JSON prevent Market from rendering.
- Limit drag renders with `requestAnimationFrame`; avoid localStorage writes, chart recreation, market refetches, and expensive recalculation per pointer event.
- Test `ResizeObserver` behavior through open, drag, close, and reopen. Do not call `fitContent()` on every resize because that would reset the user's zoom.
- Smooth transitions must not continue while dragging or when reduced-motion is enabled.

## Implementation sequence

1. Establish desktop and narrow-width layout measurements from the supplied screenshot. Add tests for the intended default chart space and keep a visual baseline at 1920x920, 1366x768, 1024x768, and mobile width.
2. Extract or introduce the Market layout owner and the typed `useMarketPaneLayout` hook. Add storage parsing, finite-value checks, clamping, reset, and tests before wiring drag interactions.
3. Add the two accessible splitters and their pointer and keyboard handling. Verify minimum widths, drag cancellation, window resize, and no chart data reload.
4. Add pane-specific close controls and reopen rails. Keep mounted state where needed, handle all-closed recovery, and verify focus behavior.
5. Compact the quote into two desktop bands, make controls non-wrapping with visible narrow-width access, add Workspace blue states, and check long-symbol/large-price containment.
6. Add animation and reduced-motion rules, then tune the tablet and mobile behavior to avoid competing with the current responsive layout.
7. Run frontend tests, lint, and build. Visually check every width and interaction, then compare chart height with the current screenshot and adjust spacing until the chart is again the dominant center element.

## Acceptance criteria

- At the supplied wide desktop size, the quote and controls occupy no more than two bands; the chart is materially taller than in the screenshot and is the dominant center element. Key quote figures and every control remain discoverable.
- Plan Decision, Replay, Diff, X-Ray, and Forensics share a Dodger blue Workspace style; Chart Layers keep neutral styling. Hover, focus, pressed, and disabled states are legible.
- Watchlist and analytics widths resize by dragging; the center grows or shrinks accordingly. All three panes can close independently and reopen to a sensible prior width.
- Collapsing and reopening is smooth, dragging is direct, and reduced-motion users see no forced animation. Keyboard operation and visible focus work for all layout controls.
- Resizing or hiding panes does not change the selected symbol, trigger quote/OHLC refetches, reset chart zoom, or break Replay, OHLC selection, analytics tabs, or Workspace actions.
- Tablet and mobile layouts remain usable without horizontal page overflow or inaccessible controls.
