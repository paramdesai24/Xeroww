import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioMetrics } from "./PortfolioMetrics";

afterEach(cleanup);

describe("PortfolioMetrics", () => {
  it("shows four compact portfolio measures", () => {
    render(<PortfolioMetrics portfolio={{
      id: 1,
      name: "Core",
      cash_balance: 400_000,
      holdings_value: 600_000,
      total_value: 1_000_000,
      total_unrealized_pnl: 25_000,
      total_unrealized_pnl_pct: 4.35,
      holdings: [],
      created_at: "2026-09-23T00:00:00Z",
    }} />);

    expect(screen.getByText("Total value")).toBeTruthy();
    expect(screen.getByText("Available cash")).toBeTruthy();
    expect(screen.getByText("Invested value")).toBeTruthy();
    expect(screen.getByText("Unrealized P&L")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });
});
