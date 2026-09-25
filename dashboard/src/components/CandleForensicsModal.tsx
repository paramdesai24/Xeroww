// src/components/CandleForensicsModal.tsx
// Forensic inspector for a single selected candlestick.
// Deep deconstruction: OHLC, Body & Wick Ratios, Volume baseline, S/R distance, MA alignment, Regime, and Provenance.

import { useEffect, useState } from "react";
import { X, ShieldCheck, Database } from "lucide-react";
import { api } from "../api/client";
import type { CandleForensicsResponse } from "../types/structure";

interface Props {
  symbol: string;
  timestamp: string;
  onClose: () => void;
}

export default function CandleForensicsModal({ symbol, timestamp, onClose }: Props) {
  const [data, setData] = useState<CandleForensicsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    api.forensics
      .inspect(symbol, timestamp)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol, timestamp]);

  return (
    <div
      id="candle-forensics-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-none p-4 select-none"
    >
      <div className="bg-[#000000] border border-[#1E2538] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0B0E14] border-b border-[#1E2538] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#3B82F6]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">
              Candle Forensic Inspection
            </span>
            <span className="text-[#334155]">·</span>
            <span className="text-xs text-[#1E90FF] font-mono font-semibold">{symbol}</span>
            <span className="text-[#334155]">·</span>
            <span className="text-xs text-[#94A3B8] font-mono">{timestamp}</span>
          </div>

          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] p-1 border border-transparent hover:border-[#1E2538] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[#64748B]">
              Deconstructing deterministic candle attributes…
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-[#EF4444]">
              Failed to retrieve forensic snapshot for {timestamp}
            </div>
          ) : (
            <>
              {/* 1. OHLC Primary Box */}
              <div className="grid grid-cols-5 gap-2 p-3 bg-[#0B0E14] border border-[#1E2538] text-center">
                <div>
                  <div className="text-label text-[#64748B]">Open</div>
                  <div className="text-sm font-bold font-mono text-[#F8FAFC] tabular-nums mt-0.5">
                    ₹{data.ohlc.open.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-label text-[#64748B]">High</div>
                  <div className="text-sm font-bold font-mono text-[#F8FAFC] tabular-nums mt-0.5">
                    ₹{data.ohlc.high.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-label text-[#64748B]">Low</div>
                  <div className="text-sm font-bold font-mono text-[#F8FAFC] tabular-nums mt-0.5">
                    ₹{data.ohlc.low.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-label text-[#64748B]">Close</div>
                  <div
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      data.ohlc.is_bullish ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    ₹{data.ohlc.close.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-label text-[#64748B]">Day Range</div>
                  <div className="text-sm font-bold font-mono text-[#F8FAFC] tabular-nums mt-0.5">
                    ₹{data.ohlc.day_range.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 2. Geometric Anatomy & Ratios */}
              <div className="p-3 bg-[#0B0E14] border border-[#1E2538] space-y-2">
                <div className="text-xs font-semibold text-[#94A3B8]">
                  Geometric Anatomy
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 bg-[#10141D] border border-[#1E2538]">
                    <div className="text-label text-[#94A3B8]">Body Ratio</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] tabular-nums">
                      {data.anatomy.body_ratio_pct}%
                    </div>
                    <div className="text-label font-mono text-[#64748B]">₹{data.anatomy.body_size}</div>
                  </div>
                  <div className="p-2.5 bg-[#10141D] border border-[#1E2538]">
                    <div className="text-label text-[#94A3B8]">Upper Shadow</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] tabular-nums">
                      {data.anatomy.upper_shadow_ratio_pct}%
                    </div>
                    <div className="text-label font-mono text-[#64748B]">₹{data.anatomy.upper_shadow}</div>
                  </div>
                  <div className="p-2.5 bg-[#10141D] border border-[#1E2538]">
                    <div className="text-label text-[#94A3B8]">Lower Shadow</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] tabular-nums">
                      {data.anatomy.lower_shadow_ratio_pct}%
                    </div>
                    <div className="text-label font-mono text-[#64748B]">₹{data.anatomy.lower_shadow}</div>
                  </div>
                </div>
              </div>

              {/* 3. Deterministic Market Structure Context */}
              <div className="grid grid-cols-2 gap-3">
                {/* Volume Profile */}
                <div className="p-3 bg-[#0B0E14] border border-[#1E2538] space-y-2">
                  <div className="text-xs font-semibold text-[#94A3B8]">
                    Volume Context
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Volume:</span>
                    <span className="text-[#F8FAFC] font-mono tabular-nums font-bold">
                      {(data.volume_context.volume / 1e5).toFixed(2)}L
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Relative Volume (RVOL):</span>
                    <span className="text-[#1E90FF] font-mono tabular-nums font-bold">
                      {data.volume_context.rvol}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">State:</span>
                    <span className="text-[#F8FAFC] font-semibold">
                      {data.volume_context.volume_state}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Price/Volume Relation:</span>
                    <span className="text-[#22C55E] font-semibold">
                      {data.volume_context.relationship}
                    </span>
                  </div>
                </div>

                {/* S/R & Moving Average Context */}
                <div className="p-3 bg-[#0B0E14] border border-[#1E2538] space-y-2">
                  <div className="text-xs font-semibold text-[#94A3B8]">
                    S/R &amp; Moving Averages
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Nearest Support:</span>
                    <span className="text-[#22C55E] font-mono font-semibold tabular-nums">
                      {data.support_resistance_context.nearest_support
                        ? `₹${data.support_resistance_context.nearest_support.price} (-${data.support_resistance_context.nearest_support.distance_pct}%)`
                        : "---"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Nearest Resistance:</span>
                    <span className="text-[#EF4444] font-mono font-semibold tabular-nums">
                      {data.support_resistance_context.nearest_resistance
                        ? `₹${data.support_resistance_context.nearest_resistance.price} (+${data.support_resistance_context.nearest_resistance.distance_pct}%)`
                        : "---"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Price vs EMA 20:</span>
                    <span className="text-[#F8FAFC] font-semibold">
                      {data.moving_average_context.price_vs_ema20}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Market Regime:</span>
                    <span className="text-[#1E90FF] font-semibold">
                      {data.regime_context.regime}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Verifiable Data Provenance Box */}
              <div className="p-3 bg-[#05070B] border border-[#1E2538] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3B82F6]">
                  <Database size={13} />
                  <span>Data Provenance &amp; Audit Trail</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-label text-[#94A3B8]">
                  <div>
                    <span className="text-[#64748B] mr-1.5">Source Provider:</span>
                    <span className="text-[#F8FAFC] font-mono">{data.provenance.source_provider}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] mr-1.5">Algorithm:</span>
                    <span className="text-[#F8FAFC]">Candle forensics</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] mr-1.5">Calc Window:</span>
                    <span className="text-[#F8FAFC] font-mono">{data.provenance.calculation_window}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] mr-1.5">Calculated At:</span>
                    <span className="text-[#F8FAFC] font-mono">{data.provenance.calculation_timestamp}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
