// src/components/replay/EventTimeline.tsx
// Institutional Market Event Timeline — Git-history style chronological event ledger.
// Synchronized with historical replay. Deterministic point-in-time domain events.

import { useMemo, useState } from "react";
import {
  GitCommit,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ShieldAlert,
  Compass,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { MarketEvent, EventSeverity, MarketEventType } from "../../types/events";

interface EventTimelineProps {
  events: MarketEvent[];
  currentStep: number;
  totalSteps?: number;
  selectedEventId?: string | null;
  onSelectEvent: (event: MarketEvent) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

function getEventIcon(type: MarketEventType, _severity?: EventSeverity) {
  const iconProps = { size: 12, className: "shrink-0" };
  switch (type) {
    case "PRICE_BREAKOUT":
      return <TrendingUp {...iconProps} className="text-[#22C55E]" />;
    case "PRICE_BREAKDOWN":
      return <TrendingDown {...iconProps} className="text-[#EF4444]" />;
    case "SUPPORT_TEST":
      return <ShieldAlert {...iconProps} className="text-[#3B82F6]" />;
    case "RESISTANCE_REJECTION":
      return <ShieldAlert {...iconProps} className="text-[#F59E0B]" />;
    case "PATTERN_DETECTED":
      return <Compass {...iconProps} className="text-[#A855F7]" />;
    case "EMA_CROSS":
      return <Zap {...iconProps} className="text-[#06B6D4]" />;
    case "HIGH_RVOL":
      return <Activity {...iconProps} className="text-[#F97316]" />;
    case "TREND_REVERSAL":
      return <Layers {...iconProps} className="text-[#EC4899]" />;
    default:
      return <GitCommit {...iconProps} className="text-[#94A3B8]" />;
  }
}

function getSeverityColor(severity: EventSeverity) {
  switch (severity) {
    case "CRITICAL":
      return {
        bg: "bg-[#EF4444]/15",
        border: "border-[#EF4444]/40",
        text: "text-[#EF4444]",
        railDot: "bg-[#EF4444]",
      };
    case "WARNING":
      return {
        bg: "bg-[#F59E0B]/15",
        border: "border-[#F59E0B]/40",
        text: "text-[#F59E0B]",
        railDot: "bg-[#F59E0B]",
      };
    case "INFO":
    default:
      return {
        bg: "bg-[#1E90FF]/15",
        border: "border-[#1E90FF]/40",
        text: "text-[#1E90FF]",
        railDot: "bg-[#1E90FF]",
      };
  }
}

export function EventTimeline({
  events,
  currentStep,
  totalSteps,
  selectedEventId,
  onSelectEvent,
  loading = false,
  onRefresh,
}: EventTimelineProps) {
  const [severityFilter, setSeverityFilter] = useState<"ALL" | EventSeverity>("ALL");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Strictly chronological point-in-time filter: only events that have occurred up to currentStep
  const revealedEvents = useMemo(() => {
    return events.filter((e) => e.candle_index <= currentStep);
  }, [events, currentStep]);

  // Sort descending by candle_index so the latest session event is on top (like recent sessions)
  const sortedRevealedEvents = useMemo(() => {
    return [...revealedEvents].sort((a, b) => b.candle_index - a.candle_index);
  }, [revealedEvents]);

  const filteredEvents = useMemo(() => {
    if (severityFilter === "ALL") return sortedRevealedEvents;
    return sortedRevealedEvents.filter((e) => e.severity === severityFilter);
  }, [sortedRevealedEvents, severityFilter]);

  if (loading) {
    return (
      <div className="p-4 text-center text-xs font-mono text-[#64748B] flex items-center justify-center gap-2">
        <Activity size={14} className="text-[#1E90FF] animate-spin shrink-0" />
        <span className="whitespace-nowrap">Deriving deterministic point-in-time events…</span>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-6 text-center text-xs font-mono text-[#64748B] flex flex-col items-center gap-2.5">
        <span className="whitespace-nowrap">No market domain events detected in this historical window.</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-[#1E90FF]/15 hover:bg-[#1E90FF]/25 border border-[#1E90FF]/40 text-[#1E90FF] text-[11px] font-semibold transition-colors whitespace-nowrap"
          >
            Reload Events
          </button>
        )}
      </div>
    );
  }

  // If events exist for this symbol but none have occurred yet up to currentStep
  if (sortedRevealedEvents.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#05070B] border border-[#1E2538] select-none min-h-0">
        <div className="px-3 py-2 bg-[#0B0E14] border-b border-[#1E2538] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <GitCommit size={13} className="text-[#1E90FF] shrink-0" />
            <span className="text-xs font-bold font-mono tracking-wider text-[#F8FAFC] whitespace-nowrap">
              EVENT TIMELINE
            </span>
            <span className="text-[10px] text-[#64748B] font-mono px-1.5 py-0.2 bg-[#10141D] border border-[#1E2538] rounded-sm whitespace-nowrap">
              0 revealed · {events.length} total
            </span>
          </div>
        </div>
        <div className="flex-1 p-6 text-center text-xs font-mono text-[#64748B] flex flex-col items-center justify-center gap-2.5">
          <GitCommit size={24} className="text-[#1E90FF] animate-pulse" />
          <span className="text-[#94A3B8] font-semibold whitespace-nowrap">
            Awaiting chronological market events…
          </span>
          <p className="text-[11px] text-[#64748B] leading-relaxed max-w-[280px] m-0">
            Bar {currentStep + 1}{totalSteps ? ` / ${totalSteps}` : ""}: Advance playback or press <span className="text-[#1E90FF] font-semibold">Play</span>. Events will reveal dynamically as sessions unfold.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#05070B] border border-[#1E2538] select-none min-h-0">
      {/* Header with filter controls */}
      <div className="px-3 py-2 bg-[#0B0E14] border-b border-[#1E2538] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <GitCommit size={13} className="text-[#1E90FF] shrink-0" />
          <span className="text-xs font-bold font-mono tracking-wider text-[#F8FAFC] whitespace-nowrap">
            EVENT TIMELINE
          </span>
          <span className="text-[10px] text-[#64748B] font-mono px-1.5 py-0.2 bg-[#10141D] border border-[#1E2538] rounded-sm whitespace-nowrap">
            {filteredEvents.length} revealed · {events.length} total
          </span>
        </div>

        {/* Severity filter pills */}
        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
          <Filter size={10} className="text-[#64748B] mr-0.5 shrink-0" />
          {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => {
            const active = severityFilter === sev;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-1.5 py-0.5 border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#1E2538] border-[#3B82F6] text-[#60A5FA] font-semibold"
                    : "bg-transparent border-transparent text-[#64748B] hover:text-[#94A3B8]"
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable vertical event ledger */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 divide-y divide-[#10141D] overscroll-contain">
        {filteredEvents.map((evt) => {
          const isCurrentStep = evt.candle_index === currentStep;
          const isSelected = evt.id === selectedEventId;
          const isExpanded = evt.id === expandedEventId;
          const sevColors = getSeverityColor(evt.severity);

          return (
            <div
              key={evt.id}
              className={`group pt-1.5 first:pt-0 transition-colors ${
                isSelected
                  ? "bg-[#10141D] border-l-2 border-l-[#1E90FF]"
                  : isCurrentStep
                  ? "bg-[#0A101C] border-l-2 border-l-[#3B82F6]/70"
                  : "hover:bg-[#0B0E14] border-l-2 border-l-transparent"
              }`}
            >
              {/* Main single-line row */}
              <div
                onClick={() => onSelectEvent(evt)}
                className="px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer"
                title={`${evt.title} — Bar ${evt.candle_index + 1} (${evt.timestamp})`}
              >
                {/* Left: Timestamp + Severity Dot + Event Type Icon */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${sevColors.railDot} shrink-0 ${
                      isCurrentStep ? "animate-pulse ring-2 ring-[#1E90FF]/40" : ""
                    }`}
                  />
                  <span className="text-[11px] font-mono text-[#64748B] shrink-0 whitespace-nowrap">
                    {evt.timestamp}
                  </span>
                  <span className="text-[10px] text-[#334155] shrink-0">·</span>

                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {getEventIcon(evt.type, evt.severity)}
                    {/* CRITICAL USER REQUIREMENT: STRICTLY SINGLE LINE, TRUNCATED WITH ELLIPSIS */}
                    <span className="text-xs font-mono font-medium text-[#F8FAFC] truncate whitespace-nowrap block">
                      {evt.title}
                    </span>
                  </div>
                </div>

                {/* Right: Confidence badge & expand toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded-sm whitespace-nowrap ${sevColors.bg} ${sevColors.border} ${sevColors.text}`}
                  >
                    {(evt.explainability.confidence * 100).toFixed(0)}%
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedEventId(isExpanded ? null : evt.id);
                    }}
                    className="p-1 text-[#64748B] hover:text-[#F8FAFC] transition-colors shrink-0"
                    title={isExpanded ? "Collapse Explainability" : "Expand Explainability"}
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                </div>
              </div>

              {/* Explainability Accordion */}
              {isExpanded && (
                <div className="px-3 py-2 mx-2 mb-1 bg-[#000000] border border-[#1E2538] text-[11px] font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[#94A3B8] border-b border-[#1A1A1A] pb-1">
                    <span className="text-[#1E90FF] font-semibold truncate whitespace-nowrap">
                      SIGNAL: {evt.explainability.signal}
                    </span>
                    <span className="text-[#64748B] shrink-0 whitespace-nowrap">
                      Bar {evt.candle_index + 1}
                    </span>
                  </div>

                  <p className="text-[#CBD5E1] text-[10px] leading-relaxed m-0">
                    {evt.description}
                  </p>

                  {/* Triggered rules */}
                  {evt.explainability.triggeredRules.length > 0 && (
                    <div className="space-y-0.5 pt-1">
                      <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold whitespace-nowrap">
                        Triggered Rules:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[10px] text-[#94A3B8] pl-1">
                        {evt.explainability.triggeredRules.map((r, i) => (
                          <li key={i} className="truncate whitespace-nowrap" title={r}>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Jump action button */}
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => onSelectEvent(evt)}
                      className="px-2 py-0.5 bg-[#1E90FF]/15 hover:bg-[#1E90FF]/25 border border-[#1E90FF]/40 text-[#1E90FF] text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Jump to Candle & Inspect</span>
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
