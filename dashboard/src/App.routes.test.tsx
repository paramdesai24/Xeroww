import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./hooks/useAuth", () => ({ useAuth: () => ({
  user: { name: "Test User", role: "USER" }, isAuthenticated: true,
  logout: vi.fn(),
}) }));
vi.mock("./hooks/useMarketData", () => ({ useMarketData: () => ({
  stocks: [], quote: null, ohlc: null, pattern: null, structure: null,
  loading: false, error: null, refresh: vi.fn(),
}) }));
vi.mock("./api/client", () => ({ api: { health: () => Promise.resolve({ status: "healthy" }) } }));
vi.mock("./pages/PortfolioIntelligencePage", () => ({ default: function PortfolioDetail() {
  const { portfolioId } = useParams();
  return <div>Portfolio detail {portfolioId}</div>;
} }));
vi.mock("./pages/ReplayLabPage", () => ({ default: function ReplayDetail() {
  const { sessionId } = useParams();
  return <div>Replay detail {sessionId}</div>;
} }));

afterEach(cleanup);

describe("detail routes", () => {
  it("supplies the portfolio ID to its detail page", async () => {
    render(<MemoryRouter initialEntries={["/portfolio/7/overview"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Portfolio detail 7")).toBeInTheDocument();
  });

  it("supplies the replay session ID to its detail page", async () => {
    render(<MemoryRouter initialEntries={["/replay-lab/12"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Replay detail 12")).toBeInTheDocument();
  });
});
