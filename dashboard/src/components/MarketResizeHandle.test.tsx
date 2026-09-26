import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketResizeHandle from "./MarketResizeHandle";

describe("Market pane resize handle", () => {
  it("offers labeled keyboard resizing for the left divider", () => {
    const onChange = vi.fn();
    const onFinish = vi.fn();
    render(<MarketResizeHandle side="watchlist" value={224} minimum={180} maximum={440} onChange={onChange} onDragState={vi.fn()} onFinish={onFinish} />);
    const divider = screen.getByRole("separator", { name: "Resize Watchlist and chart" });
    expect(divider).toHaveAttribute("aria-valuenow", "224");
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(234);
    fireEvent.keyDown(divider, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith(184);
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it("reverses direction for the right divider", () => {
    const onChange = vi.fn();
    render(<MarketResizeHandle side="analytics" value={380} minimum={280} maximum={500} onChange={onChange} onDragState={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize chart and analytics" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(390);
  });
});
