// src/components/Navbar.tsx
// Top navigation bar — Xeroww branding, API health indicator, market data disclaimer.

import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function Navbar() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .health()
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false));
  }, []);

  return (
    <nav className="h-11 bg-[#0A0A0A] border-b border-[#262626] flex items-center px-4 justify-between shrink-0 z-20">
      {/* Brand & Market Terminal Identifier */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold tracking-widest text-[#FAFAFA] uppercase">
            Xeroww
          </span>
          <span className="text-[#262626]">/</span>
          <span className="text-[11px] font-mono tracking-wider text-[#A1A1AA] uppercase">
            Market Terminal
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold tracking-wider bg-[#171717] text-[#A1A1AA] border border-[#262626]">
          V0.5
        </span>
      </div>

      {/* Right side telemetry */}
      <div className="flex items-center gap-4 text-xs font-mono">
        {/* Data disclaimer */}
        <div className="hidden sm:flex items-center gap-1.5 text-[#A1A1AA] text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <span>NSE FEED (15M DELAY)</span>
        </div>

        <div className="h-3 w-px bg-[#262626] hidden sm:block" />

        {/* Health indicator */}
        <div className="flex items-center gap-1.5">
          {healthy === null ? (
            <span className="text-[#A1A1AA] text-[11px]">CONNECTING</span>
          ) : healthy ? (
            <div className="flex items-center gap-1.5 text-[#22C55E] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span>LIVE FEED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#EF4444] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
              <span>FEED OFFLINE</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
