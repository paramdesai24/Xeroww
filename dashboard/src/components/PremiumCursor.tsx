import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type CursorMode = "default" | "hover" | "drag";

const TEXT_TARGETS = "input, textarea, [contenteditable='true'], [data-native-cursor='text']";
const CHART_TARGETS = ".chart-plot__canvas, .chart-plot__canvas *";
const DRAG_TARGETS = ".market-resize-handle, [draggable='true']";
const MAGNETIC_TARGETS = [
  ".decision-primary-action",
  ".alerts-primary",
  "#login-btn",
  ".module-nav__tab",
  ".watchlist-row",
  ".market-screener tbody tr",
  ".ui-pill",
  ".index-card",
  ".mover-row",
  ".home-watchlist > button",
].join(",");
const HOVER_TARGETS = `button, a[href], [role="button"], ${MAGNETIC_TARGETS}`;
const spring = { stiffness: 480, damping: 32, mass: 0.45 };

function closestElement(target: EventTarget | null, selector: string) {
  return target instanceof Element ? target.closest<HTMLElement>(selector) : null;
}

export default function PremiumCursor() {
  const rawX = useMotionValue(-40);
  const rawY = useMotionValue(-40);
  const x = useSpring(rawX, spring);
  const y = useSpring(rawY, spring);
  const [enabled, setEnabled] = useState(() => typeof window.matchMedia === "function"
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(false);
  const [nativeCursor, setNativeCursor] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [mode, setMode] = useState<CursorMode>("default");
  const magneticTarget = useRef<HTMLElement | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const magneticFrame = useRef(0);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAvailability = () => setEnabled(finePointer.matches && !reduceMotion.matches);
    finePointer.addEventListener("change", updateAvailability);
    reduceMotion.addEventListener("change", updateAvailability);
    return () => {
      finePointer.removeEventListener("change", updateAvailability);
      reduceMotion.removeEventListener("change", updateAvailability);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove("premium-cursor-enabled");
      return;
    }

    let lowFrameWindows = 0;
    let frames = 0;
    let sampledAt = performance.now();
    let performanceFrame = 0;

    const clearMagneticTarget = () => {
      if (magneticTarget.current) {
        magneticTarget.current.style.translate = "";
        magneticTarget.current.removeAttribute("data-magnetic-active");
        magneticTarget.current = null;
      }
    };
    const updateMagneticTarget = () => {
      magneticFrame.current = 0;
      const { x: pointerX, y: pointerY } = point.current;
      let candidate: HTMLElement | null = null;
      let nearest = 36;

      document.querySelectorAll<HTMLElement>(MAGNETIC_TARGETS).forEach((element) => {
        const rect = element.getBoundingClientRect();
        const outsideX = Math.max(rect.left - pointerX, 0, pointerX - rect.right);
        const outsideY = Math.max(rect.top - pointerY, 0, pointerY - rect.bottom);
        const distance = Math.hypot(outsideX, outsideY);
        if (distance <= nearest) {
          nearest = distance;
          candidate = element;
        }
      });

      const selected = candidate as HTMLElement | null;
      if (selected !== magneticTarget.current) clearMagneticTarget();
      if (!selected) return;
      magneticTarget.current = selected;
      const rect = selected.getBoundingClientRect();
      const deltaX = pointerX - (rect.left + rect.width / 2);
      const deltaY = pointerY - (rect.top + rect.height / 2);
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      selected.style.translate = `${(deltaX / distance).toFixed(3)}px ${(deltaY / distance).toFixed(3)}px`;
      selected.setAttribute("data-magnetic-active", "true");
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        setEnabled(false);
        return;
      }
      point.current = { x: event.clientX, y: event.clientY };
      rawX.set(event.clientX - 12);
      rawY.set(event.clientY - 12);
      setVisible(true);
      document.body.classList.add("premium-cursor-enabled");

      const textTarget = closestElement(event.target, TEXT_TARGETS);
      const chartTarget = closestElement(event.target, CHART_TARGETS);
      const dragTarget = closestElement(event.target, DRAG_TARGETS);
      const useNative = Boolean(textTarget || chartTarget);
      setNativeCursor(useNative);
      setMode(dragTarget ? "drag" : closestElement(event.target, HOVER_TARGETS) ? "hover" : "default");
      if (useNative || dragTarget) clearMagneticTarget();
      else if (!magneticFrame.current) magneticFrame.current = requestAnimationFrame(updateMagneticTarget);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") setPressed(true);
    };
    const onPointerUp = () => setPressed(false);
    const onPointerLeave = () => {
      setVisible(false);
      document.body.classList.remove("premium-cursor-enabled");
      clearMagneticTarget();
    };
    const watchPerformance = (now: number) => {
      frames += 1;
      const elapsed = now - sampledAt;
      if (elapsed >= 1000) {
        const fps = frames * 1000 / elapsed;
        lowFrameWindows = fps < 58 ? lowFrameWindows + 1 : 0;
        frames = 0;
        sampledAt = now;
        if (lowFrameWindows >= 2) {
          document.body.classList.remove("premium-cursor-enabled");
          clearMagneticTarget();
          setEnabled(false);
          return;
        }
      }
      performanceFrame = requestAnimationFrame(watchPerformance);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);
    performanceFrame = requestAnimationFrame(watchPerformance);
    return () => {
      cancelAnimationFrame(performanceFrame);
      cancelAnimationFrame(magneticFrame.current);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
      document.body.classList.remove("premium-cursor-enabled");
      clearMagneticTarget();
    };
  }, [enabled, rawX, rawY]);

  if (!enabled) return null;

  const dotSize = pressed ? 10 : mode === "hover" ? 18 : mode === "drag" ? 16 : 12;
  return (
    <motion.div
      className="premium-cursor"
      aria-hidden="true"
      style={{ x, y }}
      animate={{ opacity: visible && !nativeCursor ? 1 : 0 }}
      transition={{ opacity: { duration: 0.12 } }}
      data-mode={mode}
      data-pressed={pressed ? "true" : "false"}
    >
      <motion.span
        className="premium-cursor__ring"
        animate={{ backgroundColor: mode === "hover" ? "rgba(59, 130, 246, 0.10)" : "rgba(59, 130, 246, 0)" }}
        transition={{ type: "spring", ...spring }}
      />
      <motion.span
        className="premium-cursor__dot"
        animate={{ width: dotSize, height: dotSize }}
        transition={{ type: "spring", ...spring }}
      />
      {mode === "drag" && <span className="premium-cursor__drag-mark">{pressed ? "••" : "··"}</span>}
    </motion.div>
  );
}
