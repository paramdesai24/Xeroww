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
    setLoading(true);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-base)]/80 backdrop-blur-[2px] p-4 select-none font-mono"
    >
      <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--accent)]" />
            <span className="text-xs font-bold tracking-widest text-[var(--text-primary)] uppercase">
              CANDLE FORENSIC INSPECTION
            </span>
            <span className="text-[#404040]">·</span>
            <span className="text-xs text-[var(--accent)] font-semibold">{symbol}</span>
            <span className="text-[#404040]">·</span>
            <span className="text-xs text-[var(--text-secondary)]">{timestamp}</span>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 border border-transparent hover:border-[var(--border-subtle)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[var(--text-tertiary)]">
              DECONSTRUCTING DETERMINISTIC CANDLE ATTRIBUTES…
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-[var(--negative)]">
              FAILED TO RETRIEVE FORENSIC SNAPSHOT FOR {timestamp}
            </div>
          ) : (
            <>
              {/* 1. OHLC Primary Box */}
              <div className="grid grid-cols-5 gap-2 p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] text-center">
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">OPEN</div>
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                    ₹{data.ohlc.open.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">HIGH</div>
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                    ₹{data.ohlc.high.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">LOW</div>
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                    ₹{data.ohlc.low.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">CLOSE</div>
                  <div
                    className={`text-sm font-bold tabular-nums mt-0.5 ${
                      data.ohlc.is_bullish ? "text-[var(--positive)]" : "text-[var(--negative)]"
                    }`}
                  >
                    ₹{data.ohlc.close.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">DAY RANGE</div>
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                    ₹{data.ohlc.day_range.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 2. Geometric Anatomy & Ratios */}
              <div className="p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-2">
                <div className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest uppercase">
                  GEOMETRIC ANATOMY
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] text-[var(--text-secondary)]">BODY RATIO</div>
                    <div className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                      {data.anatomy.body_ratio_pct}%
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">₹{data.anatomy.body_size}</div>
                  </div>
                  <div className="p-2 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] text-[var(--text-secondary)]">UPPER SHADOW</div>
                    <div className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                      {data.anatomy.upper_shadow_ratio_pct}%
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">₹{data.anatomy.upper_shadow}</div>
                  </div>
                  <div className="p-2 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] text-[var(--text-secondary)]">LOWER SHADOW</div>
                    <div className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                      {data.anatomy.lower_shadow_ratio_pct}%
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">₹{data.anatomy.lower_shadow}</div>
                  </div>
                </div>
              </div>

              {/* 3. Deterministic Market Structure Context */}
              <div className="grid grid-cols-2 gap-3">
                {/* Volume Profile */}
                <div className="p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-1.5">
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest uppercase">
                    VOLUME CONTEXT
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Volume:</span>
                    <span className="text-[var(--text-primary)] tabular-nums font-bold">
                      {(data.volume_context.volume / 1e5).toFixed(2)}L
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Relative Volume (RVOL):</span>
                    <span className="text-[var(--accent)] tabular-nums font-bold">
                      {data.volume_context.rvol}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">State:</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      {data.volume_context.volume_state}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Price/Volume Relation:</span>
                    <span className="text-[var(--positive)] font-semibold">
                      {data.volume_context.relationship}
                    </span>
                  </div>
                </div>

                {/* S/R & Moving Average Context */}
                <div className="p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-1.5">
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest uppercase">
                    S/R &amp; MOVING AVERAGES
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Nearest Support:</span>
                    <span className="text-[var(--positive)] font-semibold tabular-nums">
                      {data.support_resistance_context.nearest_support
                        ? `₹${data.support_resistance_context.nearest_support.price} (-${data.support_resistance_context.nearest_support.distance_pct}%)`
                        : "---"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Nearest Resistance:</span>
                    <span className="text-[var(--negative)] font-semibold tabular-nums">
                      {data.support_resistance_context.nearest_resistance
                        ? `₹${data.support_resistance_context.nearest_resistance.price} (+${data.support_resistance_context.nearest_resistance.distance_pct}%)`
                        : "---"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Price vs EMA 20:</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      {data.moving_average_context.price_vs_ema20}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Market Regime:</span>
                    <span className="text-[var(--accent)] font-semibold">
                      {data.regime_context.regime}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Verifiable Data Provenance Box */}
              <div className="p-3 bg-[var(--surface-inset)] border border-[var(--accent)]/20 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--accent)] tracking-widest uppercase">
                  <Database size={12} />
                  <span>DATA PROVENANCE &amp; AUDIT TRAIL</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                  <div>
                    <span className="text-[var(--text-tertiary)] mr-1">SOURCE PROVIDER:</span>
                    <span className="text-[var(--text-primary)]">{data.provenance.source_provider}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)] mr-1">ALGORITHM:</span>
                    <span className="text-[var(--text-primary)]">{data.provenance.algorithm_version}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)] mr-1">CALC WINDOW:</span>
                    <span className="text-[var(--text-primary)]">{data.provenance.calculation_window}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)] mr-1">CALCULATED AT:</span>
                    <span className="text-[var(--text-primary)]">{data.provenance.calculation_timestamp}</span>
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
