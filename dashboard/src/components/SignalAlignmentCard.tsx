// src/components/SignalAlignmentCard.tsx
// Deterministic signal confluence card — v2 composable primitives & natural typography.

import { useState } from "react";
import type { SignalAlignmentResponse } from "../types/structure";
import { Panel, PanelHeader, Badge, Progress } from "./ui";

interface Props {
  alignment: SignalAlignmentResponse | null;
  loading?: boolean;
}

export default function SignalAlignmentCard({ alignment, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !alignment) {
    return (
      <Panel className="p-3">
        <span className="text-xs text-[var(--text-tertiary)]">Evaluating signal alignment…</span>
      </Panel>
    );
  }

  if (!alignment) return null;

  const isBullish = alignment.dominant_bias === "BULLISH_CONFLUENCE";
  const isBearish = alignment.dominant_bias === "BEARISH_CONFLUENCE";
  const badgeVariant = isBullish ? "green" : isBearish ? "red" : "amber";
  const accentEdge = isBullish ? "positive" : isBearish ? "negative" : "none";

  return (
    <Panel id="signal-alignment-card" accentEdge={accentEdge} className="overflow-hidden">
      <PanelHeader
        title="Signal Confluence"
        subtitle="Deterministic rule tally"
        badge={
          <Badge variant={badgeVariant} dot>
            {alignment.dominant_bias.replace(/_/g, " ")}
          </Badge>
        }
      />

      {/* Tally Grid */}
      <div className="p-3 bg-[var(--surface-inset)] border-b border-[var(--border-subtle)] grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)] font-medium">Bullish</span>
            <span className="font-bold text-[var(--positive)] font-mono tabular-nums">
              {alignment.bullish_alignment_count} / {alignment.alignment_total}
            </span>
          </div>
          <Progress
            value={alignment.bullish_alignment_count}
            max={alignment.alignment_total}
            color="green"
            height={4}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)] font-medium">Bearish</span>
            <span className="font-bold text-[var(--negative)] font-mono tabular-nums">
              {alignment.bearish_alignment_count} / {alignment.alignment_total}
            </span>
          </div>
          <Progress
            value={alignment.bearish_alignment_count}
            max={alignment.alignment_total}
            color="red"
            height={4}
          />
        </div>
      </div>

      {/* Factual Summary */}
      <div className="p-3 flex flex-col gap-2">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
          {alignment.factual_summary}
        </p>

        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <button
            id="toggle-conditions-btn"
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors duration-150 py-0.5"
          >
            <span>{expanded ? "▲ Hide conditions" : "▼ Inspect 12 conditions"}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] font-normal">Rules audit</span>
          </button>

          {expanded && (
            <div className="mt-2.5 flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
              {alignment.conditions.map((c) => (
                <div
                  key={c.condition_id}
                  className="p-2 bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-xs"
                >
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 border shrink-0 ${
                      c.satisfied
                        ? c.bias === "bullish"
                          ? "bg-[var(--positive-subtle)] text-[var(--positive)] border-[var(--positive-border)]"
                          : "bg-[var(--negative-subtle)] text-[var(--negative)] border-[var(--negative-border)]"
                        : "bg-[var(--surface-elevated)] text-[var(--text-tertiary)] border-[var(--border-default)]"
                    }`}
                  >
                    {c.satisfied ? "MET" : "UNMET"}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-[var(--text-primary)]">
                      {c.label} <span className="text-[var(--text-tertiary)] font-normal">({c.bias})</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] leading-normal">
                      {c.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
