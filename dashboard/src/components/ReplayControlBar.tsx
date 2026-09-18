// src/components/ReplayControlBar.tsx
// Historical Market Replay controls — v2 quantitative research design system.
// Zero ML, zero prediction — strictly chronological historical playback.

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, StepForward, StepBack, RotateCcw, History, GitCommit } from "lucide-react";
import { api } from "../api/client";
import type { ReplayTimelineResponse, ReplayStepResponse } from "../types/structure";

interface Props {
  symbol: string;
  onStateUpdate: (state: ReplayStepResponse) => void;
  onExitReplay: () => void;
  showTimeline?: boolean;
  onToggleTimeline?: () => void;
  timelineEventCount?: number;
  externalStep?: number | null;
  onStepChange?: (step: number) => void;
}

// Minimal icon button
function IconBtn({
  id,
  onClick,
  title,
  children,
}: {
  id?: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      title={title}
      className="h-7 w-7 bg-[#10141D] hover:bg-[#18202F] border border-[#1E2538] hover:border-[#3B82F6] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}

export default function ReplayControlBar({
  symbol,
  onStateUpdate,
  onExitReplay,
  showTimeline = false,
  onToggleTimeline,
  timelineEventCount = 0,
  externalStep = null,
  onStepChange,
}: Props) {
  const [timeline, setTimeline] = useState<ReplayTimelineResponse | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const timerRef = useRef<number | null>(null);

  const fetchStep = useCallback(
    async (step: number) => {
      try {
        const state = await api.replay.getStep(symbol, step, "3mo");
        onStateUpdate(state);
      } catch { /* graceful handle */ }
    },
    [symbol, onStateUpdate]
  );

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  // Synchronize when externalStep changes (e.g. from EventTimeline jump)
  useEffect(() => {
    if (externalStep !== null && externalStep !== undefined && externalStep !== currentStep && timeline) {
      const clamped = Math.max(0, Math.min(externalStep, timeline.total_bars - 1));
      queueMicrotask(() => {
        setCurrentStep(clamped);
        void fetchStep(clamped);
      });
    }
  }, [externalStep, currentStep, timeline, fetchStep]);

  useEffect(() => {
    let active = true;
    api.replay
      .getTimeline(symbol, "3mo")
      .then((res) => {
        if (active) {
          setTimeline(res);
          setCurrentStep(0);
          setLoading(false);
          api.replay.getStep(symbol, 0, "3mo").then(onStateUpdate);
        }
      })
      .catch(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [symbol, onStateUpdate]);

  const handleSeek = (step: number) => { setCurrentStep(step); fetchStep(step); };
  const handleStepForward = () => {
    if (!timeline) return;
    const next = Math.min(currentStep + 1, timeline.total_bars - 1);
    setCurrentStep(next); fetchStep(next);
  };
  const handleStepBack = () => {
    const prev = Math.max(currentStep - 1, 0);
    setCurrentStep(prev); fetchStep(prev);
  };

  useEffect(() => {
    if (isPlaying && timeline) {
      const intervalMs = Math.max(200, 1000 / speed);
      timerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= timeline.total_bars - 1) { setIsPlaying(false); return prev; }
          const next = prev + 1;
          fetchStep(next);
          return next;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, speed, timeline, fetchStep]);

  if (loading || !timeline) {
    return (
      <div className="px-4 py-2 bg-[#05070B] border-b border-[#1E2538] text-xs text-[#64748B] flex items-center gap-2">
        <History size={13} className="text-[#1E90FF] animate-spin" />
        <span>Initializing historical replay state for <span className="font-semibold text-[#F8FAFC]">{symbol}</span>…</span>
      </div>
    );
  }

  const curItem = timeline.timeline[currentStep] || { time: "---", close: 0 };

  return (
    <div
      id="replay-control-bar"
      className="px-4 py-2 bg-[#05070B] border-b border-[#1E90FF]/50 flex items-center justify-between gap-3 select-none flex-wrap"
    >
      {/* Mode badge + status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1E90FF]/15 border border-[#1E90FF]/40 text-[#1E90FF] text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF] flex-shrink-0 animate-pulse" />
          <span>Replay Mode</span>
        </div>
        <div className="text-xs text-[#94A3B8] flex items-center gap-2 font-mono">
          <span className="text-[#64748B]">Bar</span>
          <span className="font-semibold tabular-nums text-[#F8FAFC]">
            {currentStep + 1} / {timeline.total_bars}
          </span>
          <span className="text-[#334155]">·</span>
          <span className="text-[#1E90FF] tabular-nums font-semibold">{curItem.time}</span>
          <span className="text-[#334155]">·</span>
          <span className="text-[#F8FAFC] tabular-nums font-medium">
            ₹{curItem.close.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-1.5">
        <IconBtn id="replay-step-back" onClick={handleStepBack} title="Step Backward (t−1)">
          <StepBack size={13} />
        </IconBtn>

        <button
          id="replay-play-pause"
          onClick={() => setIsPlaying(!isPlaying)}
          className={`h-7 px-3 flex items-center gap-1.5 text-xs font-semibold transition-colors border ${
            isPlaying
              ? "bg-[#EF4444] border-[#EF4444] text-white hover:bg-[#DC2626]"
              : "bg-[#1E90FF] border-[#1E90FF] text-white hover:bg-[#1C86EE]"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause size={12} className="fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={12} className="fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <IconBtn id="replay-step-forward" onClick={handleStepForward} title="Step Forward (t+1)">
          <StepForward size={13} />
        </IconBtn>

        <IconBtn onClick={() => handleSeek(0)} title="Reset to Beginning">
          <RotateCcw size={13} />
        </IconBtn>

        {/* Speed selector */}
        <div className="flex items-center gap-1 pl-2 ml-1 border-l border-[#1E2538]">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-6 px-1.5 text-[11px] font-mono font-semibold transition-colors border ${
                speed === s
                  ? "bg-[#1E2538] border-[#3B82F6] text-[#60A5FA]"
                  : "bg-transparent border-transparent text-[#64748B] hover:text-[#F8FAFC]"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Event Timeline Toggle */}
        {onToggleTimeline && (
          <button
            id="replay-toggle-timeline-btn"
            onClick={onToggleTimeline}
            className={`h-7 px-2.5 flex items-center gap-1.5 text-xs font-mono transition-colors border shrink-0 whitespace-nowrap ${
              showTimeline
                ? "bg-[#1E90FF]/15 border-[#1E90FF] text-[#60A5FA]"
                : "bg-[#10141D] hover:bg-[#18202F] border-[#1E2538] text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
            title="Toggle Market Event Timeline"
          >
            <GitCommit size={12} className="text-[#1E90FF] shrink-0" />
            <span className="whitespace-nowrap font-medium">Events</span>
            {typeof timelineEventCount === "number" && timelineEventCount > 0 && (
              <span className="px-1 py-0.2 text-[10px] bg-[#1E2538] text-[#38BDF8] rounded-sm font-semibold whitespace-nowrap">
                {timelineEventCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Scrubber */}
      <div className="flex-1 min-w-[180px] max-w-md flex items-center px-2">
        <input
          type="range"
          min={0}
          max={timeline.total_bars - 1}
          value={currentStep}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="w-full cursor-pointer h-1.5 bg-[#10141D] accent-[#1E90FF]"
        />
      </div>

      {/* Exit */}
      <button
        onClick={onExitReplay}
        className="h-7 px-3 text-xs font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 hover:border-[#EF4444] transition-colors"
      >
        Exit Replay
      </button>
    </div>
  );
}
