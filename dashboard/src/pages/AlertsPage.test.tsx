import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AlertsPage from "./AlertsPage";

const alerts = [
  { id: 1, symbol: "RELIANCE.NS", alert_type: "price_above", condition_payload: { threshold: 1250 }, enabled: true, created_at: "2026-09-26", triggered_at: null, latest_evaluation: { id: 10, alert_id: 1, evaluated_at: "2026-09-26T10:00:00Z", triggered: true, observed_value: 1300, message: "Price crossed threshold.", data_quality_status: "delayed" } },
  { id: 2, symbol: "TCS.NS", alert_type: "volume_spike", condition_payload: { multiplier: 2 }, enabled: false, created_at: "2026-09-26", triggered_at: null, latest_evaluation: null },
];
const { list, history } = vi.hoisted(() => ({ list: vi.fn(), history: vi.fn() }));
vi.mock("../api/client", () => ({ api: { alerts: { list, history, evaluate: vi.fn(), evaluateAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, getStocks: vi.fn().mockResolvedValue([]) } }));
vi.mock("../components/SymbolAutocomplete", () => ({ default: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => <input aria-label="Company symbol" value={value} onChange={(event) => onChange(event.target.value)} /> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
list.mockResolvedValue(alerts);
history.mockResolvedValue([alerts[0].latest_evaluation]);

function RouteReadout() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }

describe("AlertsPage", () => {
  it("keeps default rows compact and filters paused alerts", async () => {
    render(<MemoryRouter><AlertsPage /></MemoryRouter>);
    await screen.findByText("Above ₹1,250");
    expect(screen.queryByText("Volume above 2x baseline")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Paused" }));
    expect(screen.getByText("Volume above 2x baseline")).toBeInTheDocument();
    expect(screen.queryByText("Above ₹1,250")).not.toBeInTheDocument();
  });

  it("routes Market and Decision to the selected alert context", async () => {
    render(<MemoryRouter><AlertsPage /><RouteReadout /></MemoryRouter>);
    await screen.findByText("Above ₹1,250");
    fireEvent.click(screen.getByText("Decision"));
    expect(screen.getByTestId("route")).toHaveTextContent("source=ALERT");
    expect(screen.getByTestId("route")).toHaveTextContent("alertId=1");
    fireEvent.click(screen.getByText("Market"));
    expect(screen.getByTestId("route")).toHaveTextContent("/stocks/RELIANCE");
  });

  it("loads evaluation history only when requested", async () => {
    render(<MemoryRouter><AlertsPage /></MemoryRouter>);
    await screen.findByText("Above ₹1,250");
    expect(history).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("History"));
    await waitFor(() => expect(history).toHaveBeenCalledWith(1));
    expect(screen.getByText("Observed 1,300 · delayed")).toBeInTheDocument();
  });
});
