import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import WatchlistsPage from "./WatchlistsPage";

const workspace = {
  watchlists: [{ id: 1, name: "Focus", is_default: true, item_count: 2 }],
  activeId: 1,
  active: { id: 1, name: "Focus", is_default: true, item_count: 2 },
  snapshot: {
    id: 1, name: "Focus", is_default: true, as_of: "2026-09-25T10:00:00Z",
    data_note: "Delayed provider data.",
    rows: [
      { symbol: "RELIANCE.NS", company_name: "Reliance Industries", price: 2500, change: 25, change_pct: 1, quote_timestamp: "2026-09-25T10:00:00Z", context: "Above previous close", available: true, reason: null },
      { symbol: "TCS.NS", company_name: "Tata Consultancy Services", price: null, change: null, change_pct: null, quote_timestamp: null, context: "Quote unavailable", available: false, reason: "Market data is temporarily unavailable." },
    ],
  },
  loading: false, refreshing: false, mutation: null, error: null, success: null,
  select: vi.fn(), refresh: vi.fn(), create: vi.fn(), rename: vi.fn(), removeList: vi.fn(), addSymbol: vi.fn(), removeSymbol: vi.fn(), clearError: vi.fn(), clearSuccess: vi.fn(),
};

vi.mock("../features/watchlists/hooks/useWatchlistWorkspace", () => ({ useWatchlistWorkspace: () => workspace }));
afterEach(cleanup);

function RouteReadout() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}{location.search}</output>;
}

describe("WatchlistsPage", () => {
  it("retains partial evidence and filters locally", () => {
    render(<MemoryRouter><WatchlistsPage /><RouteReadout /></MemoryRouter>);
    expect(screen.getByText("Quote unavailable")).toBeInTheDocument();
    expect(screen.getByText("Above previous close")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ticker or company"), { target: { value: "Reliance" } });
    expect(screen.getByText("Reliance Industries")).toBeInTheDocument();
    expect(screen.queryByText("Tata Consultancy Services")).not.toBeInTheDocument();
  });

  it("passes symbol and source to the decision flow", () => {
    render(<MemoryRouter><WatchlistsPage /><RouteReadout /></MemoryRouter>);
    fireEvent.click(screen.getAllByText("Decision")[0]);
    expect(screen.getByTestId("route")).toHaveTextContent("/decisions/new?symbol=RELIANCE.NS&source=WATCHLIST");
  });
});
