// src/components/ReplayControlBar.tsx
// Institutional Historical Market Replay Scrubber and State Controls.
// Zero ML, zero prediction — strictly chronological historical playback.

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, StepForward, StepBack, RotateCcw } from "lucide-react";
import { api } from "../api/client";
import type { ReplayTimelineResponse, ReplayStepResponse } from "../types/structure";

interface Props {
  symbol: string;
  onStateUpdate: (state: ReplayStepResponse) => void;
  onExitReplay: () => void;
}

export default function ReplayControlBar({ symbol, onStateUpdate, onExitReplay }: Props) {
  const [timeline, setTimeline] = useState<ReplayTimelineResponse | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [loading, setLoading] = useState<boolean>(true);

  const timerRef = useRef<number | null>(null);

  // Load timeline on mount or symbol change
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.replay
      .getTimeline(symbol, "3mo")
      .then((res) => {
        if (active) {
          setTimeline(res);
          setCurrentStep(0);
          setLoading(false);
          // Initial step fetch
          api.replay.getStep(symbol, 0, "3mo").then(onStateUpdate);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [symbol, onStateUpdate]);

  const fetchStep = useCallback(
    async (step: number) => {
      try {
        const state = await api.replay.getStep(symbol, step, "3mo");
        onStateUpdate(state);
      } catch {
        // graceful handle
      }
    },
    [symbol, onStateUpdate]
  );

  const handleSeek = (step: number) => {
    setCurrentStep(step);
    fetchStep(step);
  };

  const handleStepForward = () => {
    if (!timeline) return;
    const next = Math.min(currentStep + 1, timeline.total_bars - 1);
    setCurrentStep(next);
    fetchStep(next);
  };

  const handleStepBack = () => {
    const prev = Math.max(currentStep - 1, 0);
    setCurrentStep(prev);
    fetchStep(prev);
  };

  // Auto-play loop
  useEffect(() => {
    if (isPlaying && timeline) {
      const intervalMs = Math.max(200, 1000 / speed);
      timerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= timeline.total_bars - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          fetchStep(next);
          return next;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, timeline, fetchStep]);

  if (loading || !timeline) {
    return (
      <div className="px-4 py-2 bg-[#050505] border-b border-[#262626] flex items-center justify-between font-mono text-[10px] text-[#737373]">
        INITIALIZING HISTORICAL REPLAY STATE FOR {symbol}…
      </div>
    );
  }

  const curItem = timeline.timeline[currentStep] || { time: "---", close: 0 };

  return (
    <div
      id="replay-control-bar"
      className="px-4 py-2 bg-[#050505] border-b border-[#00E5FF]/30 flex items-center justify-between gap-4 font-mono select-none flex-wrap"
    >
      {/* Mode Tag & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00E5FF]/15 border border-[#00E5FF] text-[#00E5FF] text-[10px] font-bold tracking-widest uppercase animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
          <span>REPLAY MODE ACTIVE</span>
        </div>
        <div className="text-[11px] text-[#FAFAFA]">
          <span className="text-[#737373] mr-1">BAR:</span>
          <span className="font-bold tabular-nums">
            {currentStep + 1} / {timeline.total_bars}
          </span>
          <span className="text-[#555] mx-2">·</span>
          <span className="text-[#00E5FF] font-semibold">{curItem.time}</span>
          <span className="text-[#555] mx-2">·</span>
          <span className="text-[#888]">CLOSE ₹{curItem.close.toFixed(2)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          id="replay-step-back"
          onClick={handleStepBack}
          className="p-1 border border-[#262626] hover:border-[#444] text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#111]"
          title="Step Backward (t - 1)"
        >
          <StepBack size={14} />
        </button>

        <button
          id="replay-play-pause"
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border transition-colors ${
            isPlaying
              ? "bg-[#EAB308]/20 border-[#EAB308] text-[#EAB308]"
              : "bg-[#00E5FF] border-[#00E5FF] text-[#000]"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause size={12} />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>PLAY</span>
            </>
          )}
        </button>

        <button
          id="replay-step-forward"
          onClick={handleStepForward}
          className="p-1 border border-[#262626] hover:border-[#444] text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#111]"
          title="Step Forward (t + 1)"
        >
          <StepForward size={14} />
        </button>

        <button
          onClick={() => handleSeek(0)}
          className="p-1 border border-[#262626] hover:border-[#444] text-[#737373] hover:text-[#FAFAFA] bg-[#111]"
          title="Reset to Beginning"
        >
          <RotateCcw size={14} />
        </button>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 border-l border-[#262626] pl-2 ml-1">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 text-[9px] font-bold border ${
                speed === s
                  ? "bg-[#262626] text-[#00E5FF] border-[#00E5FF]"
                  : "bg-transparent text-[#737373] border-transparent hover:text-[#AAA]"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="flex-1 min-w-[180px] flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={timeline.total_bars - 1}
          value={currentStep}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="w-full accent-[#00E5FF] bg-[#1A1A1A] h-1.5 cursor-pointer"
        />
      </div>

      {/* Exit Button */}
      <button
        onClick={onExitReplay}
        className="px-2.5 py-0.5 text-[10px] font-bold border border-[#EF4444]/40 hover:border-[#EF4444] text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors uppercase tracking-wider"
      >
        EXIT REPLAY
      </button>
    </div>
  );
}
