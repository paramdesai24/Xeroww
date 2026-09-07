// src/components/MarketBreadthModal.tsx
// Market Breadth & Advance-Decline Distribution Modal.
// Universe distribution, breadth ratio, and volume leaders.

import { useEffect, useState } from "react";
import { X, Globe } from "lucide-react";
import { api } from "../api/client";
import type { MarketBreadthResponse, CorrelationMatrixResponse } from "../types/structure";

interface Props {
  onClose: () => void;
}

export default function MarketBreadthModal({ onClose }: Props) {
  const [breadth, setBreadth] = useState<MarketBreadthResponse | null>(null);
  const [matrix, setMatrix] = useState<CorrelationMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.intelligence.getBreadth().catch(() => null),
      api.intelligence.getCorrelationMatrix(20).catch(() => null),
    ]).then(([b, m]) => {
      if (active) {
        setBreadth(b);
        setMatrix(m);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      id="market-breadth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-none p-4 select-none"
    >
      <div className="bg-[#000000] border border-[#1E2538] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0B0E14] border-b border-[#1E2538] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-[#3B82F6]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">
              Market Breadth &amp; Cross-Asset Correlation
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] p-1 border border-transparent hover:border-[#1E2538] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[#64748B]">
              Calculating universe breadth &amp; correlation matrix…
            </div>
          ) : !breadth ? (
            <div className="py-12 text-center text-[#EF4444]">
              Failed to load breadth metrics
            </div>
          ) : (
            <>
              {/* Advance / Decline Bar */}
              <div className="grid grid-cols-4 gap-2 p-3 bg-[#0B0E14] border border-[#1E2538] text-center">
                <div>
                  <div className="text-[11px] text-[#64748B]">Universe</div>
                  <div className="text-base font-bold font-mono text-[#F8FAFC] tabular-nums mt-0.5">
                    {breadth.universe_size}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#64748B]">Advancing</div>
                  <div className="text-base font-bold font-mono text-[#22C55E] tabular-nums mt-0.5">
                    {breadth.advancing}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#64748B]">Declining</div>
                  <div className="text-base font-bold font-mono text-[#EF4444] tabular-nums mt-0.5">
                    {breadth.declining}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#64748B]">Breadth Ratio</div>
                  <div className="text-base font-bold font-mono text-[#1E90FF] tabular-nums mt-0.5">
                    {breadth.breadth_ratio}
                  </div>
                </div>
              </div>

              {/* Distribution Buckets */}
              <div className="p-3 bg-[#0B0E14] border border-[#1E2538] space-y-2">
                <div className="text-xs font-semibold text-[#94A3B8]">
                  Percentage Move Distribution
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-[#22C55E]/10 border border-[#22C55E]/30">
                    <div className="text-[11px] font-semibold text-[#22C55E]">&gt; +2%</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] mt-0.5 tabular-nums">
                      {breadth.distribution_buckets.gain_gt_2pct}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#10141D] border border-[#1E2538]">
                    <div className="text-[11px] text-[#22C55E]/80">0% to +2%</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] mt-0.5 tabular-nums">
                      {breadth.distribution_buckets.gain_0_to_2pct}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#10141D] border border-[#1E2538]">
                    <div className="text-[11px] text-[#EF4444]/80">-2% to 0%</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] mt-0.5 tabular-nums">
                      {breadth.distribution_buckets.loss_0_to_2pct}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#EF4444]/10 border border-[#EF4444]/30">
                    <div className="text-[11px] font-semibold text-[#EF4444]">&lt; -2%</div>
                    <div className="text-base font-bold font-mono text-[#F8FAFC] mt-0.5 tabular-nums">
                      {breadth.distribution_buckets.loss_gt_2pct}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cross-Asset Correlation Matrix */}
              {matrix && (
                <div className="p-3 bg-[#0B0E14] border border-[#1E2538] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#94A3B8]">
                      Pearson Correlation Matrix (20-Session Rolling)
                    </div>
                    <span className="text-[10px] text-[#64748B]">
                      Empirical correlation · Not causality
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse font-mono">
                      <thead>
                        <tr className="border-b border-[#1E2538] text-[#64748B]">
                          <th className="p-1.5 text-left font-sans font-medium text-[#94A3B8]">Symbol</th>
                          {matrix.symbols.map((s) => (
                            <th key={s} className="p-1.5 text-right font-medium">
                              {s.replace(".NS", "")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.symbols.map((s1) => (
                          <tr key={s1} className="border-b border-[#1E2538]/60 hover:bg-[#10141D]">
                            <td className="p-1.5 font-bold text-[#F8FAFC] font-sans">{s1.replace(".NS", "")}</td>
                            {matrix.symbols.map((s2) => {
                              const val = matrix.matrix[s1]?.[s2] ?? 0;
                              return (
                                <td
                                  key={s2}
                                  className={`p-1.5 text-right tabular-nums ${
                                    s1 === s2
                                      ? "text-[#475569]"
                                      : val > 0.5
                                      ? "text-[#22C55E] font-semibold"
                                      : val < -0.3
                                      ? "text-[#EF4444] font-semibold"
                                      : "text-[#94A3B8]"
                                  }`}
                                >
                                  {val.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
