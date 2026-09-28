import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ModuleNav from "./ModuleNav";
import { ThemeProvider } from "../theme/ThemeProvider";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("ModuleNav", () => {
  it("renders both responsive Xeroww logo assets", () => {
    render(<ThemeProvider>
      <ModuleNav
        activeModule="STOCK"
        onModuleChange={vi.fn()}
        onOpenSymbol={vi.fn()}
        user={null}
        onLogout={vi.fn()}
      />
    </ThemeProvider>);

    expect(screen.getByAltText("Xeroww")).toHaveAttribute("src", "/xeroww-logo-long.png");
  });

  it("preserves module navigation behavior", () => {
    const onModuleChange = vi.fn();
    render(<ThemeProvider>
      <ModuleNav
        activeModule="STOCK"
        onModuleChange={onModuleChange}
        onOpenSymbol={vi.fn()}
        user={null}
        onLogout={vi.fn()}
      />
    </ThemeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Portfolio" }));
    expect(onModuleChange).toHaveBeenCalledWith("PORTFOLIO");
  });

  it("switches the visible logo with the active theme", () => {
    localStorage.setItem("xeroww:theme", "dark");
    render(<ThemeProvider>
      <ModuleNav
        activeModule="HOME"
        onModuleChange={vi.fn()}
        onOpenSymbol={vi.fn()}
        user={null}
        onLogout={vi.fn()}
      />
    </ThemeProvider>);

    expect(screen.getByAltText("Xeroww")).toHaveAttribute("src", "/xeroww-logo-long.png");
    fireEvent.click(screen.getByRole("button", { name: "Use light theme" }));
    expect(screen.getByAltText("Xeroww")).toHaveAttribute("src", "/xeroww-logo-long-light.png");
  });

  it("labels the decision workspace clearly", () => {
    render(<ThemeProvider>
      <ModuleNav
        activeModule="JOURNAL"
        onModuleChange={vi.fn()}
        onOpenSymbol={vi.fn()}
        user={null}
        onLogout={vi.fn()}
      />
    </ThemeProvider>);
    expect(screen.getByRole("button", { name: "Decisions" })).toBeInTheDocument();
  });
});
