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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-base)]/80 backdrop-blur-[2px] p-4 select-none font-mono"
    >
      <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-[var(--accent)]" />
            <span className="text-xs font-bold tracking-widest text-[var(--text-primary)] uppercase">
              MARKET BREADTH &amp; CROSS-ASSET CORRELATION
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 border border-transparent hover:border-[var(--border-subtle)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[var(--text-tertiary)]">
              CALCULATING UNIVERSE BREADTH &amp; CORRELATION MATRIX…
            </div>
          ) : !breadth ? (
            <div className="py-12 text-center text-[var(--negative)]">
              FAILED TO LOAD BREADTH METRICS
            </div>
          ) : (
            <>
              {/* Advance / Decline Bar */}
              <div className="grid grid-cols-4 gap-2 p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] text-center">
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">UNIVERSE</div>
                  <div className="text-base font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                    {breadth.universe_size}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">ADVANCING</div>
                  <div className="text-base font-bold text-[var(--positive)] tabular-nums mt-0.5">
                    {breadth.advancing}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">DECLINING</div>
                  <div className="text-base font-bold text-[var(--negative)] tabular-nums mt-0.5">
                    {breadth.declining}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">BREADTH RATIO</div>
                  <div className="text-base font-bold text-[var(--accent)] tabular-nums mt-0.5">
                    {breadth.breadth_ratio}
                  </div>
                </div>
              </div>

              {/* Distribution Buckets */}
              <div className="p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-2">
                <div className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest uppercase">
                  PERCENTAGE MOVE DISTRIBUTION
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-[var(--surface-inset)] border border-[#18181B]">
                    <div className="text-[9px] text-[var(--positive)]">&gt; +2%</div>
                    <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                      {breadth.distribution_buckets.gain_gt_2pct}
                    </div>
                  </div>
                  <div className="p-2 bg-[var(--surface-inset)] border border-[#18181B]">
                    <div className="text-[9px] text-[var(--positive)]/70">0% to +2%</div>
                    <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                      {breadth.distribution_buckets.gain_0_to_2pct}
                    </div>
                  </div>
                  <div className="p-2 bg-[var(--surface-inset)] border border-[#18181B]">
                    <div className="text-[9px] text-[var(--negative)]/70">-2% to 0%</div>
                    <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                      {breadth.distribution_buckets.loss_0_to_2pct}
                    </div>
                  </div>
                  <div className="p-2 bg-[var(--surface-inset)] border border-[#18181B]">
                    <div className="text-[9px] text-[var(--negative)]">&lt; -2%</div>
                    <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                      {breadth.distribution_buckets.loss_gt_2pct}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cross-Asset Correlation Matrix */}
              {matrix && (
                <div className="p-3 bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest uppercase">
                      PEARSON CORRELATION MATRIX (20-SESSION ROLLING)
                    </div>
                    <span className="text-[9px] text-[var(--text-tertiary)]">
                      Empirical correlation · Not causality
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                          <th className="p-1 text-left font-normal">SYMBOL</th>
                          {matrix.symbols.map((s) => (
                            <th key={s} className="p-1 text-right font-normal">
                              {s.replace(".NS", "")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.symbols.map((s1) => (
                          <tr key={s1} className="border-b border-[#151515]">
                            <td className="p-1 font-bold text-[var(--text-secondary)]">{s1.replace(".NS", "")}</td>
                            {matrix.symbols.map((s2) => {
                              const val = matrix.matrix[s1]?.[s2] ?? 0;
                              return (
                                <td
                                  key={s2}
                                  className={`p-1 text-right tabular-nums ${
                                    s1 === s2
                                      ? "text-[var(--text-tertiary)]"
                                      : val > 0.5
                                      ? "text-[var(--positive)]"
                                      : val < -0.3
                                      ? "text-[var(--negative)]"
                                      : "text-[var(--text-secondary)]"
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
