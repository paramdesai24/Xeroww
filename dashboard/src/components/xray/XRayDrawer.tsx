// src/components/xray/XRayDrawer.tsx
// Flagship X-Ray Mode: Institutional right-side inspection drawer.
// 250ms smooth slide animation, Bloomberg-grade forensic analysis, and zero-flicker candle updates.

import { useRef } from "react";
import { X, ChevronLeft, ChevronRight, ShieldCheck, Layers, Compass, Database, Activity } from "lucide-react";
import type { XRayInspectionData } from "../../types/xray";
import { XRayAnatomy } from "./XRayAnatomy";
import { XRayPatternEngine } from "./XRayPatternEngine";
import { XRayMarketStructure } from "./XRayMarketStructure";
import { XRayProvenance } from "./XRayProvenance";

interface XRayDrawerProps {
  isOpen: boolean;
  data: XRayInspectionData | null;
  onClose: () => void;
  onPrevCandle?: () => void;
  onNextCandle?: () => void;
}

export function XRayDrawer({
  isOpen,
  data,
  onClose,
  onPrevCandle,
  onNextCandle,
}: XRayDrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Subtle Backdrop on smaller screens / mobile */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right-Side Slide-out Drawer */}
      <aside
        id="xray-inspection-drawer"
        aria-label="X-Ray Forensic Inspection"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 bottom-0 z-40 w-[420px] max-w-[95vw] xl:w-[460px] bg-[#000000] border-l border-[#232323] border-t-2 border-t-[#1E90FF] shadow-2xl flex flex-col min-h-0 overflow-hidden transform transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header — Bloomberg Institutional Telemetry */}
        <div className="px-4 py-3 bg-[#080808] border-b border-[#232323] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-[rgba(30,144,255,0.12)] border border-[rgba(30,144,255,0.35)] flex items-center justify-center text-[#1E90FF] shrink-0">
              <ShieldCheck size={14} />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FAFAFA]" style={{ fontFamily: "var(--font-mono)" }}>
                  X-RAY FORENSICS
                </span>
                <span className="text-[10px] text-[#6B6B72]">·</span>
                <span className="text-xs font-bold text-[#1E90FF] font-mono truncate">
                  {data?.symbol.replace(".NS", "") ?? "ASSET"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#A0A0A8] font-mono">
                <span>{data?.timestamp ?? "---"}</span>
                {data && (
                  <>
                    <span>·</span>
                    <span>
                      Bar {data.candleIndex + 1}/{data.totalCandles}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stepper Controls & Close Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onPrevCandle && onNextCandle && data && (
              <div className="flex items-center bg-[#161616] border border-[#232323] rounded-sm p-0.5 mr-1">
                <button
                  onClick={onPrevCandle}
                  disabled={data.candleIndex <= 0}
                  className="p-1 text-[#A0A0A8] hover:text-[#FAFAFA] disabled:opacity-30 transition-colors"
                  title="Previous Session (Left Arrow)"
                >
                  <ChevronLeft size={13} />
                </button>
                <div className="w-[1px] h-3 bg-[#232323]" />
                <button
                  onClick={onNextCandle}
                  disabled={data.candleIndex >= data.totalCandles - 1}
                  className="p-1 text-[#A0A0A8] hover:text-[#FAFAFA] disabled:opacity-30 transition-colors"
                  title="Next Session (Right Arrow)"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-2 py-1 flex items-center gap-1.5 text-xs font-mono text-[#A0A0A8] hover:text-[#FAFAFA] bg-[#161616] hover:bg-[#232323] border border-[#232323] rounded-sm transition-colors"
              title="Close X-Ray Drawer (Esc)"
            >
              <span className="text-[10px] text-[#6B6B72] hidden sm:inline">ESC</span>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Quick Jump Navigation Strip */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#05070B] border-b border-[#1A1A1A] shrink-0 text-[10px] font-mono overflow-x-auto">
          <button
            onClick={() => scrollToSection("xray-section-anatomy")}
            className="px-2 py-0.5 rounded-[2px] bg-[#0D0D0D] hover:bg-[#161616] text-[#A0A0A8] hover:text-[#FAFAFA] border border-[#232323] transition-colors shrink-0 flex items-center gap-1"
          >
            <Activity size={10} className="text-[#22C55E]" />
            Anatomy
          </button>
          <button
            onClick={() => scrollToSection("xray-section-pattern")}
            className="px-2 py-0.5 rounded-[2px] bg-[#0D0D0D] hover:bg-[#161616] text-[#A0A0A8] hover:text-[#FAFAFA] border border-[#232323] transition-colors shrink-0 flex items-center gap-1"
          >
            <Compass size={10} className="text-[#1E90FF]" />
            Pattern Engine
          </button>
          <button
            onClick={() => scrollToSection("xray-section-structure")}
            className="px-2 py-0.5 rounded-[2px] bg-[#0D0D0D] hover:bg-[#161616] text-[#A0A0A8] hover:text-[#FAFAFA] border border-[#232323] transition-colors shrink-0 flex items-center gap-1"
          >
            <Layers size={10} className="text-[#A0A0A8]" />
            Structure
          </button>
          <button
            onClick={() => scrollToSection("xray-section-provenance")}
            className="px-2 py-0.5 rounded-[2px] bg-[#0D0D0D] hover:bg-[#161616] text-[#A0A0A8] hover:text-[#FAFAFA] border border-[#232323] transition-colors shrink-0 flex items-center gap-1"
          >
            <Database size={10} className="text-[#1E90FF]" />
            Lineage
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 bg-[#000000] overscroll-contain"
        >
          {data ? (
            <>
              {/* Section 1: Candle Anatomy */}
              <div id="xray-section-anatomy">
                <XRayAnatomy anatomy={data.anatomy} timestamp={data.timestamp} />
              </div>

              {/* Section 2: Pattern Engine Display */}
              <div id="xray-section-pattern">
                <XRayPatternEngine pattern={data.pattern} />
              </div>

              {/* Section 3: Market Structure */}
              <div id="xray-section-structure">
                <XRayMarketStructure
                  structure={data.marketStructure}
                  currentClose={data.anatomy.close}
                />
              </div>

              {/* Section 4: Data Provenance */}
              <div id="xray-section-provenance">
                <XRayProvenance provenance={data.provenance} />
              </div>
            </>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-2 text-xs font-mono text-[#6B6B72]">
              <ShieldCheck size={28} className="text-[#1E90FF] animate-pulse" />
              <span>Click any candlestick on the chart to initiate X-Ray forensics…</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
