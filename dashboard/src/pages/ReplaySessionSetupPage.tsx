import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import SymbolAutocomplete from "../components/SymbolAutocomplete";
import type { ReplaySessionCreate } from "../types/replayLab";

export default function ReplaySessionSetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ReplaySessionCreate>({ symbol: "RELIANCE.NS", randomize_symbol: false, randomize_start: true, timeframe: "1d", session_bars: 20, starting_capital: 100000, maximum_risk_pct: 1, hide_symbol: false, hide_calendar_date: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof ReplaySessionCreate>(key: K, value: ReplaySessionCreate[K]) => setForm((current) => ({ ...current, [key]: value }));
  const create = async () => { setBusy(true); setError(null); try { const created = await api.replayLab.create({ ...form, symbol: form.randomize_symbol ? null : form.symbol }); navigate(`/replay-lab/${created.id}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Session creation failed"); } finally { setBusy(false); } };
  return <main className="decision-page intelligence-page">
    <header className="decision-page__header"><div><p className="decision-eyebrow">Replay setup</p><h1>Configure a Session</h1><p>Randomization reduces hindsight bias. Hidden dates keep the exercise focused on visible evidence.</p></div><Link className="decision-secondary-action" to="/replay-lab">Back</Link></header>
    {error && <div className="decision-error">{error}</div>}
    <section className="decision-form intelligence-form">
      <div className="decision-form__grid">
        <label>Instrument<SymbolAutocomplete value={form.symbol || ""} onChange={(value) => update("symbol", value)} /></label>
        <label>Timeframe<select value={form.timeframe} onChange={(event) => update("timeframe", event.target.value as ReplaySessionCreate["timeframe"])}><option value="1d">Daily</option><option value="1h">Hourly</option><option value="15m">15 minute</option></select></label>
        <label>Session bars<input type="number" min="5" max="120" value={form.session_bars} onChange={(event) => update("session_bars", Number(event.target.value))} /></label>
        <label>Starting capital<input type="number" value={form.starting_capital} onChange={(event) => update("starting_capital", Number(event.target.value))} /></label>
        <label>Maximum risk %<input type="number" min="0.1" max="5" step="0.1" value={form.maximum_risk_pct} onChange={(event) => update("maximum_risk_pct", Number(event.target.value))} /></label>
        <label>Setup category<input value={form.setup_category || ""} onChange={(event) => update("setup_category", event.target.value)} placeholder="Breakout, pullback, range" /></label>
      </div>
      <div className="intelligence-checks">
        <label><input type="checkbox" checked={form.randomize_symbol} onChange={(event) => update("randomize_symbol", event.target.checked)} /> Randomize NIFTY 50 symbol</label>
        <label><input type="checkbox" checked={form.randomize_start} onChange={(event) => update("randomize_start", event.target.checked)} /> Randomize start date</label>
        <label><input type="checkbox" checked={form.hide_symbol} onChange={(event) => update("hide_symbol", event.target.checked)} /> Hide symbol during session</label>
        <label><input type="checkbox" checked={form.hide_calendar_date} onChange={(event) => update("hide_calendar_date", event.target.checked)} /> Hide calendar date</label>
      </div>
      <button className="decision-primary-action" disabled={busy} onClick={() => void create()}>{busy ? "Preparing dataset..." : "Create Replay Session"}</button>
    </section>
  </main>;
}
