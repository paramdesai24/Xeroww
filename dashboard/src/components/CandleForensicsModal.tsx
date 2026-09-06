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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/80 backdrop-blur-[2px] p-4 select-none font-mono"
    >
      <div className="bg-[#0A0A0A] border border-[#262626] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[#050505] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#00E5FF]" />
            <span className="text-xs font-bold tracking-widest text-[#FAFAFA] uppercase">
              CANDLE FORENSIC INSPECTION
            </span>
            <span className="text-[#404040]">·</span>
            <span className="text-xs text-[#00E5FF] font-semibold">{symbol}</span>
            <span className="text-[#404040]">·</span>
            <span className="text-xs text-[#A1A1AA]">{timestamp}</span>
          </div>

          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#FAFAFA] p-1 border border-transparent hover:border-[#262626]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[#737373]">
              DECONSTRUCTING DETERMINISTIC CANDLE ATTRIBUTES…
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-[#EF4444]">
              FAILED TO RETRIEVE FORENSIC SNAPSHOT FOR {timestamp}
            </div>
          ) : (
            <>
              {/* 1. OHLC Primary Box */}
              <div className="grid grid-cols-5 gap-2 p-3 bg-[#000000] border border-[#1A1A1A] text-center">
                <div>
                  <div className="text-[10px] text-[#737373]">OPEN</div>
                  <div className="text-sm font-bold text-[#FAFAFA] tabular-nums mt-0.5">
                    ₹{data.ohlc.open.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#737373]">HIGH</div>
                  <div className="text-sm font-bold text-[#FAFAFA] tabular-nums mt-0.5">
                    ₹{data.ohlc.high.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#737373]">LOW</div>
                  <div className="text-sm font-bold text-[#FAFAFA] tabular-nums mt-0.5">
                    ₹{data.ohlc.low.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#737373]">CLOSE</div>
                  <div
                    className={`text-sm font-bold tabular-nums mt-0.5 ${
                      data.ohlc.is_bullish ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    ₹{data.ohlc.close.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#737373]">DAY RANGE</div>
                  <div className="text-sm font-bold text-[#FAFAFA] tabular-nums mt-0.5">
                    ₹{data.ohlc.day_range.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 2. Geometric Anatomy & Ratios */}
              <div className="p-3 bg-[#000000] border border-[#1A1A1A] space-y-2">
                <div className="text-[10px] font-bold text-[#737373] tracking-widest uppercase">
                  GEOMETRIC ANATOMY
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-[#0A0A0A] border border-[#262626]">
                    <div className="text-[10px] text-[#A1A1AA]">BODY RATIO</div>
                    <div className="text-base font-bold text-[#FAFAFA] tabular-nums">
                      {data.anatomy.body_ratio_pct}%
                    </div>
                    <div className="text-[10px] text-[#737373]">₹{data.anatomy.body_size}</div>
                  </div>
                  <div className="p-2 bg-[#0A0A0A] border border-[#262626]">
                    <div className="text-[10px] text-[#A1A1AA]">UPPER SHADOW</div>
                    <div className="text-base font-bold text-[#FAFAFA] tabular-nums">
                      {data.anatomy.upper_shadow_ratio_pct}%
                    </div>
                    <div className="text-[10px] text-[#737373]">₹{data.anatomy.upper_shadow}</div>
                  </div>
                  <div className="p-2 bg-[#0A0A0A] border border-[#262626]">
                    <div className="text-[10px] text-[#A1A1AA]">LOWER SHADOW</div>
                    <div className="text-base font-bold text-[#FAFAFA] tabular-nums">
                      {data.anatomy.lower_shadow_ratio_pct}%
                    </div>
                    <div className="text-[10px] text-[#737373]">₹{data.anatomy.lower_shadow}</div>
                  </div>
                </div>
              </div>

              {/* 3. Deterministic Market Structure Context */}
              <div className="grid grid-cols-2 gap-3">
                {/* Volume Profile */}
                <div className="p-3 bg-[#000000] border border-[#1A1A1A] space-y-1.5">
                  <div className="text-[10px] font-bold text-[#737373] tracking-widest uppercase">
                    VOLUME CONTEXT
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Volume:</span>
                    <span className="text-[#FAFAFA] tabular-nums font-bold">
                      {(data.volume_context.volume / 1e5).toFixed(2)}L
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Relative Volume (RVOL):</span>
                    <span className="text-[#00E5FF] tabular-nums font-bold">
                      {data.volume_context.rvol}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">State:</span>
                    <span className="text-[#FAFAFA] font-semibold">
                      {data.volume_context.volume_state}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Price/Volume Relation:</span>
                    <span className="text-[#22C55E] font-semibold">
                      {data.volume_context.relationship}
                    </span>
                  </div>
                </div>

                {/* S/R & Moving Average Context */}
                <div className="p-3 bg-[#000000] border border-[#1A1A1A] space-y-1.5">
                  <div className="text-[10px] font-bold text-[#737373] tracking-widest uppercase">
                    S/R &amp; MOVING AVERAGES
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Nearest Support:</span>
                    <span className="text-[#22C55E] font-semibold tabular-nums">
                      {data.support_resistance_context.nearest_support
                        ? `₹${data.support_resistance_context.nearest_support.price} (-${data.support_resistance_context.nearest_support.distance_pct}%)`
                        : "---"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Nearest Resistance:</span>
                    <span className="text-[#EF4444] font-semibold tabular-nums">
                      {data.support_resistance_context.nearest_resistance
                        ? `₹${data.support_resistance_context.nearest_resistance.price} (+${data.support_resistance_context.nearest_resistance.distance_pct}%)`
                        : "---"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Price vs EMA 20:</span>
                    <span className="text-[#FAFAFA] font-semibold">
                      {data.moving_average_context.price_vs_ema20}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Market Regime:</span>
                    <span className="text-[#00E5FF] font-semibold">
                      {data.regime_context.regime}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Verifiable Data Provenance Box */}
              <div className="p-3 bg-[#050505] border border-[#00E5FF]/20 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00E5FF] tracking-widest uppercase">
                  <Database size={12} />
                  <span>DATA PROVENANCE &amp; AUDIT TRAIL</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[11px] text-[#A1A1AA]">
                  <div>
                    <span className="text-[#737373] mr-1">SOURCE PROVIDER:</span>
                    <span className="text-[#FAFAFA]">{data.provenance.source_provider}</span>
                  </div>
                  <div>
                    <span className="text-[#737373] mr-1">ALGORITHM:</span>
                    <span className="text-[#FAFAFA]">{data.provenance.algorithm_version}</span>
                  </div>
                  <div>
                    <span className="text-[#737373] mr-1">CALC WINDOW:</span>
                    <span className="text-[#FAFAFA]">{data.provenance.calculation_window}</span>
                  </div>
                  <div>
                    <span className="text-[#737373] mr-1">CALCULATED AT:</span>
                    <span className="text-[#FAFAFA]">{data.provenance.calculation_timestamp}</span>
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
