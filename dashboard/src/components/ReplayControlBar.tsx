// src/components/ReplayControlBar.tsx
// Historical Market Replay controls — graphite-and-paper design system.
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
      style={{
        padding: "4px 6px",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border-default)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1), color 160ms cubic-bezier(0.16,1,0.3,1)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
      }}
    >
      {children}
    </button>
  );
}

export default function ReplayControlBar({ symbol, onStateUpdate, onExitReplay }: Props) {
  const [timeline, setTimeline] = useState<ReplayTimelineResponse | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const timerRef = useRef<number | null>(null);

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
          api.replay.getStep(symbol, 0, "3mo").then(onStateUpdate);
        }
      })
      .catch(() => { if (active) setLoading(false); });

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
      } catch { /* graceful handle */ }
    },
    [symbol, onStateUpdate]
  );

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
      <div style={{
        padding: "7px 16px",
        backgroundColor: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.08em",
        color: "var(--text-disabled)",
        textTransform: "uppercase",
      }}>
        Initializing historical replay state for {symbol}…
      </div>
    );
  }

  const curItem = timeline.timeline[currentStep] || { time: "---", close: 0 };

  return (
    <div
      id="replay-control-bar"
      style={{
        padding: "6px 16px",
        backgroundColor: "var(--surface-raised)",
        borderBottom: "2px solid var(--accent-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontFamily: "var(--font-mono)",
        userSelect: "none",
        flexWrap: "wrap",
      }}
    >
      {/* Mode badge + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          backgroundColor: "var(--accent-subtle)",
          border: "1px solid var(--accent-border)",
          color: "var(--accent)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--accent)", flexShrink: 0, display: "block" }} />
          Replay
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--text-disabled)" }}>Bar</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
            {currentStep + 1} / {timeline.total_bars}
          </span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{curItem.time}</span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
            ₹{curItem.close.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Playback controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconBtn id="replay-step-back" onClick={handleStepBack} title="Step Backward (t−1)">
          <StepBack size={13} />
        </IconBtn>

        <button
          id="replay-play-pause"
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.08em",
            cursor: "pointer",
            border: "1px solid",
            backgroundColor: isPlaying ? "var(--warning-subtle)" : "var(--accent-subtle)",
            borderColor: isPlaying ? "var(--warning-border)" : "var(--accent-border)",
            color: isPlaying ? "var(--warning)" : "var(--accent)",
            transition: "all 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {isPlaying ? <><Pause size={11} /><span>PAUSE</span></> : <><Play size={11} /><span>PLAY</span></>}
        </button>

        <IconBtn id="replay-step-forward" onClick={handleStepForward} title="Step Forward (t+1)">
          <StepForward size={13} />
        </IconBtn>

        <IconBtn onClick={() => handleSeek(0)} title="Reset to Beginning">
          <RotateCcw size={13} />
        </IconBtn>

        {/* Speed selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, paddingLeft: 8, marginLeft: 4, borderLeft: "1px solid var(--border-subtle)" }}>
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: "2px 6px",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                backgroundColor: speed === s ? "var(--surface-overlay)" : "transparent",
                borderColor: speed === s ? "var(--border-strong)" : "transparent",
                color: speed === s ? "var(--text-primary)" : "var(--text-disabled)",
                transition: "all 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center" }}>
        <input
          type="range"
          min={0}
          max={timeline.total_bars - 1}
          value={currentStep}
          onChange={(e) => handleSeek(Number(e.target.value))}
          style={{ width: "100%", cursor: "pointer", accentColor: "var(--accent)" }}
        />
      </div>

      {/* Exit */}
      <button
        onClick={onExitReplay}
        style={{
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          cursor: "pointer",
          border: "1px solid var(--negative-border)",
          backgroundColor: "var(--negative-subtle)",
          color: "var(--negative)",
          transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1)",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--negative)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--negative-border)"}
      >
        Exit Replay
      </button>
    </div>
  );
}
