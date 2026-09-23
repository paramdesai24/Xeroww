import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import MiniSeriesChart from "../components/MiniSeriesChart";
import type { ReplayEvent, ReplaySessionState } from "../types/replayLab";
import { PageErrorState } from "../components/ui";
import { parsePositiveIntParam } from "../lib/routeParams";

const money = (value: number) => `INR ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ReplayLabPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const id = parsePositiveIntParam(sessionId);
  const [state, setState] = useState<ReplaySessionState | null>(null);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (id === null) return; try { const [next, timeline] = await Promise.all([api.replayLab.get(id), api.replayLab.events(id)]); setState(next); setEvents(timeline); } catch (reason) { setError(reason instanceof Error ? reason.message : "Replay session failed to load"); } }, [id]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const command = async (action: "start" | "advance" | "pause" | "resume" | "abandon") => { if (!state || id === null) return; setBusy(true); setError(null); try { const next = await api.replayLab.command(id, action, state.version); setState(next); setEvents(await api.replayLab.events(id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Replay command failed"); } finally { setBusy(false); } };
  const exit = async () => { if (!state || id === null) return; setBusy(true); try { const next = await api.replayLab.exit(id, state.version, "EVIDENCE", "Exited because the visible evidence no longer supported the plan."); setState(next); } catch (reason) { setError(reason instanceof Error ? reason.message : "Exit failed"); } finally { setBusy(false); } };
  const latest = state?.candles.at(-1);
  const decisionUrl = useMemo(() => state ? `/decisions/new?source=REPLAY&replaySessionId=${id}&symbol=${encodeURIComponent(state.symbol)}&asOf=${encodeURIComponent(state.current_market_time)}&capital=${state.starting_capital}&period=${encodeURIComponent(state.timeframe)}` : "#", [state, id]);
  if (id === null) return <PageErrorState title="Invalid replay session" message="This replay session link is invalid." actionHref="/replay-lab" actionLabel="Back to Replay Lab" />;
  if (!state) return <main className="decision-page"><div className={error ? "decision-error" : "decision-empty"}>{error || "Loading replay session..."}</div></main>;
  const dateLabel = state.calendar_date_hidden ? `Candle ${state.visible_step + 1}` : new Date(state.current_market_time).toLocaleString("en-IN");
  return <main className="decision-page intelligence-page">
    <header className="decision-page__header"><div><p className="decision-eyebrow">Replay session {state.id}</p><h1>{state.symbol_hidden ? "Hidden Instrument" : state.symbol}</h1><p>{dateLabel} · {state.timeframe} · {state.remaining_bars} bars remain</p></div><div className="decision-header-actions"><Link className="decision-secondary-action" to="/replay-lab">Sessions</Link>{state.status === "COMPLETED" && <Link className="decision-primary-action" to={`/replay-lab/${id}/review`}>Review</Link>}</div></header>
    {error && <div className="decision-error">{error}</div>}
    <section className="intelligence-kpis">
      <article><span>Status</span><strong>{state.status.replaceAll("_", " ")}</strong></article>
      <article><span>Last close</span><strong>{latest ? money(latest.close) : "Unavailable"}</strong></article>
      <article><span>Position</span><strong>{state.position.is_open ? `${state.position.quantity} @ ${state.position.average_entry}` : "Flat"}</strong></article>
      <article><span>Cash</span><strong>{money(state.current_cash)}</strong></article>
      <article><span>Maximum risk</span><strong>{state.maximum_risk_pct}%</strong></article>
    </section>
    <section className="intelligence-workspace">
      <div className="intelligence-main">
        <MiniSeriesChart values={state.candles.map((candle) => candle.close)} label="Point-in-time replay price series" />
        <div className="intelligence-actions">
          {state.status === "SETUP" && <button className="decision-primary-action" disabled={busy} onClick={() => void command("start")}>Start Session</button>}
          {state.decision_required && <button className="decision-primary-action" onClick={() => navigate(decisionUrl)}>Record Decision</button>}
          {state.status === "ACTIVE" && <><button className="decision-primary-action" disabled={busy} onClick={() => void command("advance")}>Reveal Next Candle</button><button className="decision-secondary-action" disabled={busy} onClick={() => void command("pause")}>Pause</button></>}
          {state.status === "PAUSED" && <button className="decision-primary-action" disabled={busy} onClick={() => void command("resume")}>Resume</button>}
          {state.status === "ACTIVE" && state.position.is_open && <button className="decision-secondary-action" disabled={busy} onClick={() => void exit()}>Exit at Current Close</button>}
          {!(["COMPLETED", "ABANDONED"] as string[]).includes(state.status) && <button className="decision-secondary-action" disabled={busy} onClick={() => void command("abandon")}>End Session</button>}
        </div>
      </div>
      <aside className="intelligence-aside">
        <div><p className="decision-eyebrow">Visible evidence</p>{state.compact_evidence.map((item) => <article className="intelligence-evidence" key={item.key}><strong>{item.label.replaceAll("_", " ")}</strong><span>{item.explanation}</span></article>)}</div>
        <details><summary>Session timeline</summary><ol className="intelligence-timeline">{events.slice().reverse().map((event) => <li key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>Candle {event.replay_index - (state.current_index - state.visible_step) + 1}</span></li>)}</ol></details>
        <details><summary>Data provenance</summary><pre>{JSON.stringify(state.provenance, null, 2)}</pre></details>
      </aside>
    </section>
  </main>;
}
