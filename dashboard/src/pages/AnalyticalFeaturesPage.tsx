import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Database, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { normalizeError, type AppError } from "../api/errors";
import FeatureSeriesChart from "../components/analytics/FeatureSeriesChart";
import { EmptyState, ErrorNotice, Skeleton, Surface } from "../components/ui";
import type { AnalyticalFeatureResponse } from "../types/analytics";

function utcInputValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}

function parseUtcInput(value: string): Date {
  return new Date(`${value}:00.000Z`);
}

function formatFeature(value: number | null, digits = 4): string {
  return value == null ? "Not available" : value.toFixed(digits);
}

function formatUtcTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function AnalyticalFeaturesPage() {
  const params = useParams();
  const navigate = useNavigate();
  const routedSymbol = decodeURIComponent(params.symbol ?? "").toUpperCase();
  const initialEnd = useMemo(() => new Date(), []);
  const initialStart = useMemo(() => new Date(initialEnd.getTime() - 24 * 60 * 60 * 1000), [initialEnd]);
  const [symbol, setSymbol] = useState(routedSymbol);
  const [startInput, setStartInput] = useState(utcInputValue(initialStart));
  const [endInput, setEndInput] = useState(utcInputValue(initialEnd));
  const [response, setResponse] = useState<AnalyticalFeatureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async (requestedSymbol: string, start: Date, end: Date) => {
    setLoading(true);
    setError(null);
    try {
      setResponse(await api.analytics.getFeatures(requestedSymbol, start, end, 500));
    } catch (reason) {
      setResponse(null);
      setError(normalizeError(reason, "Analytical history could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routedSymbol) queueMicrotask(() => void load(routedSymbol, initialStart, initialEnd));
  }, [initialEnd, initialStart, load, routedSymbol]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedSymbol = symbol.trim().toUpperCase();
    const start = parseUtcInput(startInput);
    const end = parseUtcInput(endInput);
    if (!normalizedSymbol || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError(normalizeError(new Error("Enter a symbol and a valid increasing UTC range.")));
      return;
    }
    if (normalizedSymbol !== routedSymbol) {
      navigate(`/analytics/features/${encodeURIComponent(normalizedSymbol)}`);
      return;
    }
    void load(normalizedSymbol, start, end);
  };

  const rows = response?.data ?? [];
  const latest = rows.at(-1) ?? null;

  return (
    <main className="analytical-page">
      <header className="analytical-page__header">
        <div><span className="analytical-page__eyebrow"><Database size={14} /> Distributed analytics</span><h1>Feature history</h1><p>Warehouse-computed returns, volatility, and relative volume. This view is separate from live market prices.</p></div>
        <button type="button" onClick={() => navigate(`/stocks/${encodeURIComponent(routedSymbol.replace(/\.NS$/, ""))}`)}>Back to live market</button>
      </header>

      <Surface className="analytical-query-panel">
        <form onSubmit={submit}>
          <label>Symbol<input aria-label="Analytical symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} /></label>
          <label>Start, UTC<input aria-label="Start time UTC" type="datetime-local" value={startInput} onChange={(event) => setStartInput(event.target.value)} /></label>
          <label>End, UTC<input aria-label="End time UTC" type="datetime-local" value={endInput} onChange={(event) => setEndInput(event.target.value)} /></label>
          <button type="submit" disabled={loading}>{loading ? <RefreshCw size={15} className="analytical-spin" /> : null}{loading ? "Loading" : "Run query"}</button>
        </form>
        <span>UTC range · Up to 500 feature windows</span>
      </Surface>

      {loading && !response ? <section className="analytical-loading" aria-label="Loading analytical history"><Skeleton height={110} /><Skeleton height={240} /><Skeleton height={240} /></section> : null}
      {error ? <ErrorNotice error={error} onRetry={routedSymbol ? () => void load(routedSymbol, parseUtcInput(startInput), parseUtcInput(endInput)) : undefined} /> : null}
      {!loading && !error && response && rows.length === 0 ? <EmptyState title="No analytical history" message="No warehouse feature windows were found for this symbol and UTC range." /> : null}

      {response && rows.length > 0 ? <>
        <section className="analytical-summary" aria-label="Feature summary">
          <Surface><span>Feature windows</span><strong>{response.count}</strong><small>{formatUtcTimestamp(response.start_time)} to {formatUtcTimestamp(response.end_time)} UTC</small></Surface>
          <Surface><span>Latest log return</span><strong>{formatFeature(latest?.log_return ?? null, 6)}</strong><small>Computed return, not price change</small></Surface>
          <Surface><span>Latest volatility</span><strong>{formatFeature(latest?.rolling_volatility ?? null, 6)}</strong><small>{latest?.rolling_volatility == null ? "Insufficient rolling observations" : "Rolling feature value"}</small></Surface>
          <Surface><span>Latest relative volume</span><strong>{formatFeature(latest?.relative_volume ?? null, 3)}</strong><small>{latest?.relative_volume == null ? "Not available" : "Relative to rolling baseline"}</small></Surface>
        </section>

        <section className="analytical-chart-grid">
          <FeatureSeriesChart title="Log return" description="Window-to-window logarithmic return" values={rows.map((row) => row.log_return)} valueFormatter={(value) => value.toFixed(6)} />
          <FeatureSeriesChart title="Rolling volatility" description="Dispersion across the rolling return window" values={rows.map((row) => row.rolling_volatility)} valueFormatter={(value) => value.toFixed(6)} />
          <FeatureSeriesChart title="Relative volume" description="Observed volume relative to its rolling baseline" values={rows.map((row) => row.relative_volume)} valueFormatter={(value) => `${value.toFixed(2)}×`} />
        </section>

        <Surface className="analytical-table-panel"><header><div><h2>Recent feature windows</h2><p>Newest warehouse records appear first. Times are UTC.</p></div><span>{rows.length} records</span></header><div className="analytical-table-wrap"><table><thead><tr><th>Window start</th><th>Window end</th><th>Log return</th><th>Rolling return</th><th>Volatility</th><th>RVOL</th><th>Observations</th><th>Batch</th></tr></thead><tbody>{rows.slice().reverse().map((row) => <tr key={row.record_key}><td>{formatUtcTimestamp(row.window_start)}</td><td>{formatUtcTimestamp(row.window_end)}</td><td>{formatFeature(row.log_return, 6)}</td><td>{formatFeature(row.rolling_return, 6)}</td><td>{formatFeature(row.rolling_volatility, 6)}</td><td>{formatFeature(row.relative_volume, 3)}</td><td>{row.observation_count}</td><td>{row.feature_batch_id}</td></tr>)}</tbody></table></div></Surface>

        {latest ? <details className="analytical-provenance"><summary>Latest record provenance</summary><dl><div><dt>Source</dt><dd>{latest.source}</dd></div><div><dt>Feature batch</dt><dd>{latest.feature_batch_id}</dd></div><div><dt>Kafka offset</dt><dd>{latest.max_kafka_offset}</dd></div><div><dt>Load ID</dt><dd>{latest.load_id}</dd></div><div><dt>Source file</dt><dd>{latest.source_file}</dd></div><div><dt>Source SHA-256</dt><dd>{latest.source_file_sha256}</dd></div></dl></details> : null}
      </> : null}
    </main>
  );
}
