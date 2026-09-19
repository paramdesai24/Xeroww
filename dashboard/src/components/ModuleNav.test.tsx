import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ModuleNav from "./ModuleNav";

afterEach(cleanup);

describe("ModuleNav", () => {
  it("renders both responsive Xeroww logo assets", () => {
    render(
      <ModuleNav
        activeModule="MARKET"
        onModuleChange={vi.fn()}
        user={null}
        onLogout={vi.fn()}
      />,
    );

    const logos = screen.getAllByAltText("Xeroww");
    expect(logos).toHaveLength(2);
    expect(logos[0]).toHaveAttribute("src", "/xeroww-logo.png");
    expect(logos[1]).toHaveAttribute("src", "/xeroww-logo-long.png");
  });

  it("preserves module navigation behavior", () => {
    const onModuleChange = vi.fn();
    render(
      <ModuleNav
        activeModule="MARKET"
        onModuleChange={onModuleChange}
        user={null}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Portfolio" }));
    expect(onModuleChange).toHaveBeenCalledWith("PORTFOLIO");
  });
});
