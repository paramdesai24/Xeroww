// src/components/AlertsManager.tsx
// Multi-tenant alert management: create alerts, on-demand evaluation engine.

import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Alert, AlertEvaluationResult } from "../types/platform";

const ALERT_TYPES = [
  { value: "price_above", label: "Price Above", example: '{"threshold": 2500}' },
  { value: "price_below", label: "Price Below", example: '{"threshold": 2000}' },
  { value: "percentage_move", label: "% Move", example: '{"pct": 5, "direction": "up", "reference_price": 2400}' },
  { value: "volume_spike", label: "Volume Spike", example: '{"multiplier": 2.0}' },
  { value: "pattern_detected", label: "Pattern", example: '{"pattern": "bullish_marubozu"}' },
  { value: "moving_average_cross", label: "MA Cross", example: '{"fast_period": 9, "slow_period": 21, "direction": "golden_cross"}' },
];

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [results, setResults] = useState<Record<number, AlertEvaluationResult>>({});
  const [symbol, setSymbol] = useState("");
  const [alertType, setAlertType] = useState("price_above");
  const [payloadJson, setPayloadJson] = useState('{"threshold": 2500}');
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      setAlerts(await api.alerts.list());
    } catch {}
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleAlertTypeChange = (t: string) => {
    setAlertType(t);
    const found = ALERT_TYPES.find((a) => a.value === t);
    if (found) setPayloadJson(found.example);
  };

  const createAlert = async () => {
    setPayloadError(null);
    setError(null);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      setPayloadError("Invalid JSON in condition payload.");
      return;
    }
    try {
      await api.alerts.create(symbol.trim().toUpperCase(), alertType, payload);
      setSymbol("");
      await loadAlerts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const deleteAlert = async (id: number) => {
    try {
      await api.alerts.delete(id);
      setAlerts((a) => a.filter((x) => x.id !== id));
      setResults((r) => { const n = { ...r }; delete n[id]; return n; });
    } catch {}
  };

  const evaluateOne = async (id: number) => {
    try {
      const result = await api.alerts.evaluate(id);
      setResults((r) => ({ ...r, [id]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    }
  };

  const evaluateAll = async () => {
    setEvaluating(true);
    try {
      const all = await api.alerts.evaluateAll();
      const map: Record<number, AlertEvaluationResult> = {};
      all.forEach((r) => { map[r.alert_id] = r; });
      setResults(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluate all failed");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Create panel */}
      <div className="w-72 shrink-0 border-r border-[var(--border-subtle)] flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] tracking-widest text-[#525252] font-bold">CREATE ALERT</span>
        </div>

        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">SYMBOL</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="RELIANCE.NS"
              className="w-full bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-2 py-1.5 outline-none focus:border-[var(--accent)] placeholder-[#333]"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">ALERT TYPE</label>
            <select value={alertType} onChange={(e) => handleAlertTypeChange(e.target.value)}
              className="w-full bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-2 py-1.5 outline-none focus:border-[var(--accent)]">
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">
              CONDITION (JSON)
            </label>
            <textarea value={payloadJson}
              onChange={(e) => { setPayloadJson(e.target.value); setPayloadError(null); }}
              rows={4}
              className="w-full bg-[var(--surface-overlay)] border border-[var(--border-default)] text-[var(--text-primary)] text-[10px] px-2 py-1.5 outline-none focus:border-[var(--accent)] font-mono resize-none"
            />
            {payloadError && <div className="text-[10px] text-[#ff4d4d] mt-1">{payloadError}</div>}
          </div>

          {error && <div className="text-[10px] text-[#ff4d4d]">{error}</div>}

          <button onClick={createAlert}
            className="w-full py-2 text-[10px] font-bold tracking-widest bg-[var(--accent)] text-black hover:bg-[#00cfea] transition-colors">
            CREATE ALERT
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-[10px] tracking-widest text-[#525252]">
            {alerts.length} ALERT{alerts.length !== 1 ? "S" : ""} · ON-DEMAND EVALUATION
          </span>
          <button onClick={evaluateAll} disabled={evaluating || alerts.length === 0}
            className="text-[10px] tracking-widest font-bold px-3 py-1 border border-[var(--accent)] text-[var(--accent)] hover:bg-[#0a1015] disabled:opacity-30 transition-colors">
            {evaluating ? "EVALUATING..." : "EVALUATE ALL"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="p-4 text-[11px] text-[#333] tracking-wider">NO ALERTS · CREATE ONE ON THE LEFT</div>
          ) : (
            alerts.map((alert) => {
              const result = results[alert.id];
              return (
                <div key={alert.id}
                  className="px-4 py-3 border-b border-[#111] hover:bg-[#0d0d0d]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[var(--text-primary)] font-bold">{alert.symbol}</span>
                        <span className="text-[10px] text-[#525252] tracking-wider">{alert.alert_type}</span>
                        {alert.triggered_at && (
                          <span className="text-[10px] text-[#ff9900] tracking-wider">TRIGGERED</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#333] font-mono truncate">
                        {JSON.stringify(alert.condition_payload)}
                      </div>
                      {result && (
                        <div className={`mt-1 text-[10px] ${result.triggered ? "text-[#ff9900]" : "text-[#525252]"}`}>
                          {result.triggered ? "⚡ " : "· "}{result.message}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => evaluateOne(alert.id)}
                        className="text-[10px] tracking-wider text-[var(--accent)] hover:text-[#00cfea] border border-[#1a2a2a] px-2 py-1 transition-colors">
                        EVAL
                      </button>
                      <button onClick={() => deleteAlert(alert.id)}
                        className="text-[10px] tracking-wider text-[#333] hover:text-[#ff4d4d] transition-colors">
                        DEL
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
