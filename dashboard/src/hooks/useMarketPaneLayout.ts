import { useCallback, useEffect, useMemo, useState } from "react";

export type MarketPane = "watchlist" | "center" | "analytics";
type SidePane = "watchlist" | "analytics";

export interface MarketPaneLayoutState {
  watchlistWidth: number;
  analyticsWidth: number;
  collapsed: Record<MarketPane, boolean>;
}

const STORAGE_KEY = "xeroww.market-panes.v1";
const RAIL = 32;
const HANDLE = 6;
const MIN_WATCHLIST = 180;
const MAX_WATCHLIST = 252;
const MIN_CENTER = 440;
const MIN_ANALYTICS = 280;
const defaults: MarketPaneLayoutState = {
  watchlistWidth: 208,
  analyticsWidth: 380,
  collapsed: { watchlist: false, center: false, analytics: false },
};

export function readMarketPaneLayout(raw: string | null): MarketPaneLayoutState {
  if (!raw) return defaults;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isFinite(value.watchlistWidth) || !Number.isFinite(value.analyticsWidth)) return defaults;
    if (!value.collapsed || ["watchlist", "center", "analytics"].some((key) => typeof value.collapsed[key] !== "boolean")) return defaults;
    return {
      watchlistWidth: bound(value.watchlistWidth, MIN_WATCHLIST, MAX_WATCHLIST),
      analyticsWidth: Math.max(MIN_ANALYTICS, value.analyticsWidth),
      collapsed: {
        watchlist: value.collapsed.watchlist,
        center: value.collapsed.center,
        analytics: value.collapsed.analytics,
      },
    };
  } catch {
    return defaults;
  }
}

function initialLayout() {
  try { return readMarketPaneLayout(window.localStorage.getItem(STORAGE_KEY)); }
  catch { return defaults; }
}

function bound(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function useMarketPaneLayout() {
  const [workspaceElement, workspaceRef] = useState<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<MarketPaneLayoutState>(initialLayout);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!workspaceElement) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(workspaceElement);
    return () => observer.disconnect();
  }, [workspaceElement]);

  const available = Math.max(containerWidth, 1280);
  const leftRail = layout.collapsed.watchlist ? RAIL : 0;
  const rightRail = layout.collapsed.analytics ? RAIL : 0;
  const centerRail = layout.collapsed.center ? RAIL : 0;
  const leftHandle = !layout.collapsed.watchlist && !layout.collapsed.center ? HANDLE : 0;
  const rightHandle = !layout.collapsed.analytics && !layout.collapsed.center ? HANDLE : 0;
  const preferredRight = layout.collapsed.analytics ? rightRail : bound(layout.analyticsWidth, MIN_ANALYTICS, available - MIN_WATCHLIST - MIN_CENTER - leftHandle - rightHandle);
  const leftLimit = available - MIN_CENTER - preferredRight - leftHandle - rightHandle;
  const leftWidth = layout.collapsed.watchlist ? leftRail : bound(layout.watchlistWidth, MIN_WATCHLIST, Math.min(MAX_WATCHLIST, leftLimit));
  const rightLimit = available - MIN_CENTER - leftWidth - leftHandle - rightHandle;
  const rightWidth = layout.collapsed.analytics ? rightRail : bound(layout.analyticsWidth, MIN_ANALYTICS, rightLimit);

  const columns = useMemo(() => {
    if (!layout.collapsed.center) {
      const centerWidth = Math.max(0, available - leftWidth - rightWidth - leftHandle - rightHandle);
      return `${leftWidth}px ${leftHandle}px ${centerWidth}px ${rightHandle}px ${rightWidth}px`;
    }
    const remaining = Math.max(0, available - leftWidth - centerRail - rightWidth);
    const expandedLeft = !layout.collapsed.watchlist && layout.collapsed.analytics ? leftWidth + remaining : leftWidth;
    const expandedRight = !layout.collapsed.analytics ? rightWidth + remaining : rightWidth;
    return `${expandedLeft}px 0px ${centerRail}px 0px ${expandedRight}px`;
  }, [layout.collapsed, available, centerRail, leftWidth, rightWidth, leftHandle, rightHandle]);

  const persist = useCallback((next: MarketPaneLayoutState) => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...next })); }
    catch { /* Layout still works without storage. */ }
  }, []);
  useEffect(() => { if (!dragging) persist(layout); }, [dragging, layout, persist]);

  const togglePane = useCallback((pane: MarketPane) => {
    const wasCollapsed = layout.collapsed[pane];
    setLayout((current) => {
      return { ...current, collapsed: { ...current.collapsed, [pane]: !current.collapsed[pane] } };
    });
    requestAnimationFrame(() => {
      const selector = `.market-pane--${pane} ${wasCollapsed ? ".market-pane__collapse" : ".market-pane__rail"}`;
      document.querySelector<HTMLButtonElement>(selector)?.focus();
    });
  }, [layout.collapsed]);

  const resetLayout = useCallback(() => {
    setLayout(defaults);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".market-pane--center .market-pane__collapse")?.focus());
  }, []);

  const resizePane = useCallback((pane: SidePane, requestedWidth: number) => {
    if (!Number.isFinite(requestedWidth)) return;
    setLayout((current) => {
      if (current.collapsed.center || current.collapsed[pane]) return current;
      const opposite = pane === "watchlist" ? "analytics" : "watchlist";
      const oppositeWidth = current.collapsed[opposite] ? RAIL : pane === "watchlist" ? rightWidth : leftWidth;
      const minimum = pane === "watchlist" ? MIN_WATCHLIST : MIN_ANALYTICS;
      const maximum = pane === "watchlist"
        ? Math.min(MAX_WATCHLIST, Math.max(minimum, available - oppositeWidth - MIN_CENTER - HANDLE * (current.collapsed[opposite] ? 1 : 2)))
        : Math.max(minimum, available - oppositeWidth - MIN_CENTER - HANDLE * (current.collapsed[opposite] ? 1 : 2));
      const width = bound(requestedWidth, minimum, maximum);
      return pane === "watchlist" ? { ...current, watchlistWidth: width } : { ...current, analyticsWidth: width };
    });
  }, [available, leftWidth, rightWidth]);

  const commitResize = useCallback(() => {
    setDragging(false);
  }, []);

  return [workspaceRef, {
    containerWidth, layout, columns, leftWidth, rightWidth,
    leftMax: Math.min(MAX_WATCHLIST, Math.max(MIN_WATCHLIST, leftLimit)), rightMax: Math.max(MIN_ANALYTICS, rightLimit), dragging,
    setDragging, resizePane, commitResize, togglePane, resetLayout,
  }] as const;
}
