import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OHLCTable from "./OHLCTable";
import type { OHLCBar } from "../types/market";

const candles: OHLCBar[] = [{
  time: "2026-09-28",
  open: 100,
  high: 105,
  low: 98,
  close: 103,
  volume: 1000,
}];

describe("OHLCTable", () => {
  it("starts closed and restores the existing table on demand", () => {
    const onSelectCandle = vi.fn();
    render(<OHLCTable candles={candles} onSelectCandle={onSelectCandle} />);

    const toggle = screen.getByRole("button", { name: /Recent Sessions/ });
    const content = document.getElementById("recent-sessions-content");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(content?.hidden).toBe(true);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(content?.hidden).toBe(false);
    fireEvent.click(screen.getByText("2026-09-28"));
    expect(onSelectCandle).toHaveBeenCalledWith(candles[0]);

    fireEvent.click(toggle);
    expect(content?.hidden).toBe(true);
  });
});
