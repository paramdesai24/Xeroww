import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

interface MarketResizeHandleProps {
  side: "watchlist" | "analytics";
  value: number;
  minimum: number;
  maximum: number;
  onChange: (width: number) => void;
  onDragState: (dragging: boolean) => void;
  onFinish: () => void;
}

export default function MarketResizeHandle({ side, value, minimum, maximum, onChange, onDragState, onFinish }: MarketResizeHandleProps) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number; frame: number | null; latest: number } | null>(null);

  useEffect(() => () => {
    if (drag.current?.frame !== null && drag.current?.frame !== undefined) cancelAnimationFrame(drag.current.frame);
  }, []);

  const direction = side === "watchlist" ? 1 : -1;
  const stop = (element: HTMLDivElement, pointerId: number, restore: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== pointerId) return;
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    if (restore) onChange(current.startWidth);
    else onChange(current.latest);
    drag.current = null;
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    onDragState(false);
    if (!restore) onFinish();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: value, latest: value, frame: null };
    onDragState(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latest = current.startWidth + (event.clientX - current.startX) * direction;
    if (current.frame === null) {
      current.frame = requestAnimationFrame(() => {
        if (!drag.current) return;
        onChange(drag.current.latest);
        drag.current.frame = null;
      });
    }
  };

  return (
    <div
      className={`market-resize-handle market-resize-handle--${side}`}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={side === "watchlist" ? "Resize Watchlist and chart" : "Resize chart and analytics"}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={Math.round(value)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => stop(event.currentTarget, event.pointerId, false)}
      onPointerCancel={(event) => stop(event.currentTarget, event.pointerId, true)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && drag.current) {
          stop(event.currentTarget, drag.current.pointerId, true);
          return;
        }
        const step = event.shiftKey ? 40 : 10;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onChange(value + (event.key === "ArrowRight" ? step : -step) * direction);
          onFinish();
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          onChange(event.key === "Home" ? minimum : maximum);
          onFinish();
        }
      }}
    />
  );
}
