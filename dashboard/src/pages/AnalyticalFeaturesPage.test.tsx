import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../api/errors";
import type { AnalyticalFeatureResponse } from "../types/analytics";
import AnalyticalFeaturesPage from "./AnalyticalFeaturesPage";

const getFeatures = vi.fn();
vi.mock("../api/client", () => ({ api: { analytics: { getFeatures: (...args: unknown[]) => getFeatures(...args) } } }));

function response(data = [record()]): AnalyticalFeatureResponse {
  return { symbol: "AAPL", start_time: "2026-09-29T03:00:00Z", end_time: "2026-09-29T05:00:00Z", count: data.length, data };
}

function record() {
  return {
    record_key: "c".repeat(64), logical_window_key: "b".repeat(64), feature_contract_version: 1,
    window_start: "2026-09-29T03:30:00Z", window_end: "2026-09-29T03:35:00Z", symbol: "AAPL", source: "yahoo",
    observation_count: 5, log_return: 0.001248, rolling_return: null, rolling_volatility: null, relative_volume: null,
    kafka_partitions: [0, 1], max_kafka_offset: 874, feature_batch_id: 87,
    source_file: "/opt/spark/output/features/batch_id=87/part-00000.json", source_file_sha256: "a".repeat(64),
    load_id: "load-batch-87", warehouse_ingested_at: "2026-09-29T04:00:00Z",
  };
}

function renderPage() {
  return render(<MemoryRouter initialEntries={["/analytics/features/AAPL"]}><Routes><Route path="/analytics/features/:symbol" element={<AnalyticalFeaturesPage />} /></Routes></MemoryRouter>);
}

afterEach(() => { cleanup(); getFeatures.mockReset(); });

describe("AnalyticalFeaturesPage", () => {
  it("renders loading and then analytical charts, table, nullable values, and provenance", async () => {
    let resolve!: (value: AnalyticalFeatureResponse) => void;
    getFeatures.mockReturnValue(new Promise<AnalyticalFeatureResponse>((done) => { resolve = done; }));
    renderPage();
    expect(await screen.findByText("Loading")).toBeInTheDocument();
    resolve(response());
    expect(await screen.findByText("Recent feature windows")).toBeInTheDocument();
    expect(screen.getByLabelText("Log return")).toBeInTheDocument();
    expect(screen.getByLabelText("Rolling volatility")).toHaveTextContent("Not available");
    expect(screen.getByLabelText("Relative volume")).toHaveTextContent("Not available");
    expect(screen.getAllByText("87").length).toBeGreaterThan(0);
    expect(screen.getByText("/opt/spark/output/features/batch_id=87/part-00000.json")).toBeInTheDocument();
    expect(screen.getByText("load-batch-87")).toBeInTheDocument();
  });

  it("renders a clear empty state", async () => {
    getFeatures.mockResolvedValue(response([]));
    renderPage();
    expect(await screen.findByText("No analytical history")).toBeInTheDocument();
  });

  it("distinguishes an unavailable warehouse", async () => {
    getFeatures.mockRejectedValue(new AppError({ code: "HTTP_503", status: 503, message: "The analytical warehouse is unavailable." }));
    renderPage();
    expect(await screen.findByText("The analytical warehouse is unavailable.")).toBeInTheDocument();
  });

  it("does not request an invalid symbol or range", async () => {
    getFeatures.mockResolvedValue(response([]));
    renderPage();
    await waitFor(() => expect(getFeatures).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Analytical symbol"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    expect(getFeatures).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Enter a symbol and a valid increasing UTC range.")).toBeInTheDocument();
  });
});
