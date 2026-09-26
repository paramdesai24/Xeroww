import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { normalizeError, type AppError } from "../api/errors";
import SymbolAutocomplete from "../components/SymbolAutocomplete";
import { EmptyState, ErrorNotice, FieldError, SuccessNotice } from "../components/ui";
import { ALERT_TYPES, conditionSummary } from "../features/alerts/conditionFormatters";
import type { Alert, AlertEvaluationSummary } from "../types/platform";

type Filter = "active" | "triggered" | "paused" | "all";
type AlertType = (typeof ALERT_TYPES)[number]["value"];
const initialFields = { threshold: "", pct: "", direction: "up", reference_price: "", multiplier: "", pattern: "bullish_marubozu", fast_period: "9", slow_period: "21", cross_direction: "golden_cross" };
type Fields = typeof initialFields;

function conditionPayload(type: AlertType, fields: Fields): Record<string, unknown> {
  const positive = (key: keyof Fields) => {
    const value = Number(fields[key]);
    if (!fields[key].trim() || !Number.isFinite(value) || value <= 0) throw new Error(`Enter a positive ${key.replaceAll("_", " ")}.`);
    return value;
  };
  if (type === "price_above" || type === "price_below") return { threshold: positive("threshold") };
  if (type === "percentage_move") return { pct: positive("pct"), reference_price: positive("reference_price"), direction: fields.direction };
  if (type === "volume_spike") return { multiplier: positive("multiplier") };
  if (type === "pattern_detected") return { pattern: fields.pattern };
  const fast = positive("fast_period");
  const slow = positive("slow_period");
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast < 2 || slow > 200 || fast >= slow) throw new Error("Choose whole-number MA periods from 2 to 200, with fast below slow.");
  return { fast_period: fast, slow_period: slow, direction: fields.cross_direction };
}

function fieldsFromAlert(alert: Alert): Fields {
  const p = alert.condition_payload;
  return {
    threshold: String(p.threshold ?? ""), pct: String(p.pct ?? ""), direction: String(p.direction ?? "up"),
    reference_price: String(p.reference_price ?? ""), multiplier: String(p.multiplier ?? ""),
    pattern: String(p.pattern ?? "bullish_marubozu"), fast_period: String(p.fast_period ?? "9"),
    slow_period: String(p.slow_period ?? "21"), cross_direction: String(p.direction ?? "golden_cross"),
  };
}

function ConditionFields({ type, fields, setFields }: { type: AlertType; fields: Fields; setFields: (next: Fields) => void }) {
  const field = (key: keyof Fields, label: string, kind: "number" | "select" = "number", options: string[] = []) => (
    <label key={key}>{label}
      {kind === "select" ? <select value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })}>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>
        : <input type="number" min="0" step="any" value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />}
    </label>
  );
  if (type === "price_above" || type === "price_below") return field("threshold", "Price threshold (₹)");
  if (type === "percentage_move") return <>{field("pct", "Move (%)")}{field("direction", "Direction", "select", ["up", "down", "any"])}{field("reference_price", "Reference price (₹)")}</>;
  if (type === "volume_spike") return field("multiplier", "Volume multiple of baseline");
  if (type === "pattern_detected") return field("pattern", "Pattern", "select", ["bullish_marubozu", "bearish_marubozu", "any"]);
  return <>{field("fast_period", "Fast period")}{field("slow_period", "Slow period")}{field("cross_direction", "Cross direction", "select", ["golden_cross", "death_cross", "any"])}</>;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Alert | "new" | null>(null);
  const [historyAlert, setHistoryAlert] = useState<Alert | null>(null);
  const [history, setHistory] = useState<AlertEvaluationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [symbol, setSymbol] = useState(params.get("symbol") ?? "");
  const [type, setType] = useState<AlertType>("price_above");
  const [fields, setFields] = useState<Fields>(initialFields);
  const [fieldError, setFieldError] = useState("");

  const load = useCallback(async () => {
    try { setAlerts(await api.alerts.list()); setError(null); }
    catch (cause) { setError(normalizeError(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const metrics = useMemo(() => ({
    active: alerts.filter((alert) => alert.enabled).length,
    triggered: alerts.filter((alert) => alert.enabled && alert.latest_evaluation?.triggered).length,
    paused: alerts.filter((alert) => !alert.enabled).length,
    errors: alerts.filter((alert) => alert.latest_evaluation?.data_quality_status === "error").length,
  }), [alerts]);
  const visible = useMemo(() => alerts.filter((alert) => {
    if (search && !alert.symbol.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === "active") return alert.enabled;
    if (filter === "triggered") return alert.enabled && Boolean(alert.latest_evaluation?.triggered);
    if (filter === "paused") return !alert.enabled;
    return true;
  }), [alerts, filter, search]);

  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null); setNotice("");
    try { await task(); await load(); setNotice(success); }
    catch (cause) { setError(normalizeError(cause)); }
    finally { setBusy(false); }
  };
  const openEditor = (alert: Alert | "new") => {
    setEditor(alert); setFieldError(""); setError(null);
    if (alert === "new") { setType("price_above"); setFields(initialFields); setSymbol(params.get("symbol") ?? ""); }
    else { setType(alert.alert_type as AlertType); setFields(fieldsFromAlert(alert)); setSymbol(alert.symbol); }
  };
  const save = async () => {
    setFieldError("");
    let payload: Record<string, unknown>;
    try { payload = conditionPayload(type, fields); }
    catch (cause) { setFieldError(cause instanceof Error ? cause.message : "Check the condition values."); return; }
    if (!symbol.trim()) { setFieldError("Choose a company."); return; }
    const current = editor;
    await run(async () => {
      if (current && current !== "new") await api.alerts.update(current.id, { alert_type: type, condition_payload: payload });
      else await api.alerts.create(symbol.trim().toUpperCase(), type, payload);
      setEditor(null);
    }, current === "new" ? "Alert created." : "Alert updated.");
  };
  const openHistory = async (alert: Alert) => {
    setHistoryAlert(alert); setHistory([]); setHistoryLoading(true); setError(null);
    try { setHistory(await api.alerts.history(alert.id)); }
    catch (cause) { setError(normalizeError(cause)); }
    finally { setHistoryLoading(false); }
  };
  const decision = (alert: Alert) => {
    const query = new URLSearchParams({ symbol: alert.symbol, source: "ALERT", alertId: String(alert.id), trigger: conditionSummary(alert) });
    navigate(`/decisions/new?${query}`);
  };

  return <main className="workspace-page alerts-workspace">
    <header className="workspace-header"><div><p className="decision-eyebrow">Market monitoring</p><h1>Alerts</h1><p>Check conditions on demand. This is not a live price feed.</p></div>
      <div className="workspace-header__controls"><button className="workspace-button" onClick={() => void run(() => api.alerts.evaluateAll(), "Active alerts checked.")} disabled={busy || !metrics.active}>Evaluate active</button><button className="workspace-button alerts-primary" onClick={() => openEditor("new")}>New alert</button></div></header>
    <section className="workspace-metrics" aria-label="Alert overview">
      {([["Active", metrics.active], ["Triggered", metrics.triggered], ["Paused", metrics.paused], ["Evaluation errors", metrics.errors]] as const).map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    {error && <ErrorNotice error={error} onRetry={() => void load()} onDismiss={() => setError(null)} />}
    {notice && <SuccessNotice message={notice} onDismiss={() => setNotice("")} />}
    <div className="workspace-tabs" role="tablist" aria-label="Alert status">{(["active", "triggered", "paused", "all"] as const).map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}<label className="alerts-search">Search symbol<input aria-label="Search alerts by symbol" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="RELIANCE" /></label></div>
    <section className="workspace-panel alerts-list" aria-label="Configured alerts">
      <div className="workspace-panel__header"><div><h2>{filter[0].toUpperCase() + filter.slice(1)} alerts</h2><span>{visible.length} shown</span></div></div>
      {loading ? <p className="alerts-empty">Loading alerts...</p> : visible.length === 0 ? <EmptyState title="No alerts here" message={alerts.length ? "Try another status or symbol." : "Create an alert to monitor a condition."} action={!alerts.length ? <button className="workspace-button" onClick={() => openEditor("new")}>New alert</button> : undefined} /> :
        <div className="alerts-rows">{visible.map((alert) => {
          const latest = alert.latest_evaluation;
          const status = !alert.enabled ? "Paused" : latest?.data_quality_status === "error" ? "Check failed" : latest?.triggered ? "Triggered" : "Monitoring";
          return <article className="alerts-row" key={alert.id}>
            <div className="alerts-row__main"><strong>{alert.symbol}</strong><span className="alerts-row__condition">{conditionSummary(alert)}</span><span className={`alerts-status alerts-status--${status.toLowerCase().replace(" ", "-")}`}>{status}</span></div>
            <p>{latest ? latest.message : "Not checked yet"}<small>{latest ? `${new Date(latest.evaluated_at).toLocaleString()} · ${latest.data_quality_status}` : "On-demand check"}</small></p>
            <div className="workspace-row-actions alerts-row__actions"><button onClick={() => void run(() => api.alerts.evaluate(alert.id), `${alert.symbol} checked.`)} disabled={busy || !alert.enabled}>Check</button><button onClick={() => void openHistory(alert)}>History</button><button onClick={() => openEditor(alert)}>Edit</button><button onClick={() => void run(() => api.alerts.update(alert.id, { enabled: !alert.enabled }), alert.enabled ? "Alert paused." : "Alert resumed.")} disabled={busy}>{alert.enabled ? "Pause" : "Resume"}</button><button onClick={() => navigate(`/market/${encodeURIComponent(alert.symbol)}`)}>Market</button><button onClick={() => decision(alert)}>Decision</button><button className="alerts-delete" onClick={() => { if (window.confirm(`Delete ${alert.symbol} alert and its history?`)) void run(() => api.alerts.delete(alert.id), "Alert deleted."); }} disabled={busy}>Delete</button></div>
          </article>;
        })}</div>}
    </section>
    {editor && <div className="workspace-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><aside className="workspace-drawer alerts-drawer" role="dialog" aria-modal="true" aria-label={editor === "new" ? "New alert" : "Edit alert"}>
      <header><div><p className="decision-eyebrow">Condition</p><h2>{editor === "new" ? "New alert" : `Edit ${editor.symbol}`}</h2></div><button onClick={() => setEditor(null)}>Close</button></header>
      <div className="workspace-drawer__body"><label>Company{editor === "new" ? <SymbolAutocomplete value={symbol} onChange={setSymbol} /> : <input value={symbol} readOnly />}</label><label>Alert type<select value={type} onChange={(event) => setType(event.target.value as AlertType)}>{ALERT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><ConditionFields type={type} fields={fields} setFields={setFields} /><FieldError message={fieldError || error?.fieldErrors.condition_payload || error?.fieldErrors.symbol} /><p className="alerts-hint">Checks run only when you request them. Market data may be delayed.</p><button className="workspace-button alerts-primary" onClick={() => void save()} disabled={busy}>{busy ? "Saving..." : editor === "new" ? "Create alert" : "Save changes"}</button></div>
    </aside></div>}
    {historyAlert && <div className="workspace-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryAlert(null); }}><aside className="workspace-drawer alerts-drawer" role="dialog" aria-modal="true" aria-label="Alert history"><header><div><p className="decision-eyebrow">Evaluation history</p><h2>{historyAlert.symbol}</h2><p>{conditionSummary(historyAlert)}</p></div><button onClick={() => setHistoryAlert(null)}>Close</button></header><div className="workspace-drawer__body">{historyLoading ? <p>Loading checks...</p> : !history.length ? <EmptyState title="No checks yet" message="Evaluate this alert to begin its history." /> : history.map((item) => <article className="alerts-history" key={item.id}><div><strong>{item.triggered ? "Triggered" : item.data_quality_status === "error" ? "Check failed" : "Not triggered"}</strong><time>{new Date(item.evaluated_at).toLocaleString()}</time></div><p>{item.message}</p><small>{item.observed_value == null ? "No observed value" : `Observed ${item.observed_value.toLocaleString("en-IN")}`} · {item.data_quality_status}</small></article>)}</div></aside></div>}
  </main>;
}
