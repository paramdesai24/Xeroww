// src/components/AlertsManager.tsx
// Multi-tenant alert management: create alerts, on-demand evaluation engine.
// Graphite-and-paper design system.

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [results, setResults] = useState<Record<number, AlertEvaluationResult>>({});
  const [symbol, setSymbol] = useState(searchParams.get("symbol") ?? "");
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

  useEffect(() => {
    queueMicrotask(() => void loadAlerts());
  }, [loadAlerts]);

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
    <main className="workspace-page alerts-page">
      <header className="workspace-header"><div><p className="decision-eyebrow">Market monitoring</p><h1 className="type-page-title">Alerts</h1><p className="type-body">Track observed conditions in your chosen companies.</p></div></header>
      <div className="alerts-layout flex flex-1 min-h-0 overflow-hidden bg-[#000000] text-[#F8FAFC]">
      {/* Create panel */}
      <div className="w-80 shrink-0 border-r border-[#1E2538] flex flex-col bg-[#05070B]">
        <div className="px-4 py-3 border-b border-[#1E2538]">
          <span className="text-xs font-semibold text-[#94A3B8]">Create Alert</span>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE.NS"
              className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] font-mono text-xs px-3 py-2 outline-none placeholder-[#64748B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Alert Type</label>
            <select
              value={alertType}
              onChange={(e) => handleAlertTypeChange(e.target.value)}
              className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-3 py-2 outline-none transition-colors"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Condition Payload (JSON)
            </label>
            <textarea
              value={payloadJson}
              onChange={(e) => { setPayloadJson(e.target.value); setPayloadError(null); }}
              rows={4}
              className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-3 py-2 outline-none font-mono resize-none transition-colors"
            />
            {payloadError && <div className="text-xs text-[#EF4444] mt-1">{payloadError}</div>}
          </div>

          {error && <div className="text-xs text-[#EF4444]">{error}</div>}

          <button
            onClick={createAlert}
            className="w-full py-2.5 text-xs font-semibold bg-[#1E90FF] hover:bg-[#1C86EE] text-white transition-colors"
          >
            Create Alert
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
        <div className="px-4 py-3 border-b border-[#1E2538] flex items-center justify-between bg-[#05070B]">
          <span className="text-xs text-[#94A3B8]">
            <span className="font-semibold text-[#F8FAFC]">{alerts.length}</span> {alerts.length === 1 ? "alert configured" : "alerts configured"} · On-demand evaluation
          </span>
          <button
            onClick={evaluateAll}
            disabled={evaluating || alerts.length === 0}
            className="text-xs font-semibold px-3 py-1 bg-[#10141D] border border-[#3B82F6] text-[#60A5FA] hover:bg-[#1E2538] disabled:opacity-40 transition-colors"
          >
            {evaluating ? "Evaluating…" : "Evaluate All"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="p-6 text-xs text-[#64748B]">No alerts configured. Define a threshold on the left to monitor signals.</div>
          ) : (
            alerts.map((alert) => {
              const result = results[alert.id];
              return (
                <div
                  key={alert.id}
                  className="px-4 py-3 border-b border-[#1E2538]/60 hover:bg-[#0B0E14] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[#F8FAFC] font-mono font-bold">{alert.symbol}</span>
                        <span className="text-xs text-[#64748B]">{alert.alert_type}</span>
                        {alert.triggered_at && (
                          <span className="text-label px-1.5 py-0.2 bg-[#1E90FF]/10 text-[#1E90FF] border border-[#1E90FF]/30 font-semibold">
                            Triggered
                          </span>
                        )}
                      </div>
                      <div className="text-label text-[#64748B] font-mono truncate">
                        {JSON.stringify(alert.condition_payload)}
                      </div>
                      {result && (
                        <div className={`mt-1.5 text-xs font-mono ${result.triggered ? "text-[#1E90FF]" : "text-[#94A3B8]"}`}>
                          {result.triggered ? "⚡ " : "· "}{result.message}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => evaluateOne(alert.id)}
                        className="text-xs text-[#F8FAFC] hover:text-[#3B82F6] border border-[#1E2538] hover:border-[#3B82F6] px-2.5 py-1 bg-[#10141D] transition-colors"
                      >
                        Evaluate
                      </button>
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="text-xs text-[#64748B] hover:text-[#EF4444] px-2 py-1 transition-colors"
                      >
                        Delete
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
    </main>
  );
}
