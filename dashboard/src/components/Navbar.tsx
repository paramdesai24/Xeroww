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
    <nav
      className="h-11 border-b border-[var(--border-default)] flex items-center px-4 justify-between shrink-0 z-20"
      style={{ backgroundColor: "var(--canvas)", fontFamily: "var(--font-sans)" }}
    >
      {/* Responsive brand lockup */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/xeroww-logo.png"
            alt="Xeroww"
            className="block h-8 w-8 shrink-0 object-contain sm:hidden"
            width="1254"
            height="1254"
          />
          <img
            src="/xeroww-logo-long.png"
            alt="Xeroww"
            className="hidden h-9 w-auto max-w-[38vw] shrink-0 object-contain object-left sm:block"
            width="2172"
            height="724"
          />
          <span className="hidden text-[var(--border-strong)] md:inline">/</span>
          <span className="hidden whitespace-nowrap text-xs text-[var(--text-secondary)] md:inline">
            Market Terminal
          </span>
        </div>
      </div>

      {/* Right side telemetry */}
      <div className="flex items-center gap-4 text-xs">
        {/* Data disclaimer */}
        <div className="hidden sm:flex items-center gap-1.5 text-[var(--text-tertiary)] text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />
          <span>NSE Feed (15m delayed)</span>
        </div>

        <div className="h-3 w-px bg-[var(--border-default)] hidden sm:block" />

        {/* Health indicator */}
        <div className="flex items-center gap-1.5">
          {healthy === null ? (
            <span className="text-[var(--text-tertiary)] text-xs">Connecting…</span>
          ) : healthy ? (
            <div className="flex items-center gap-1.5 text-[var(--positive)] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)]" />
              <span>Live feed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--negative)] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--negative)]" />
              <span>Feed offline</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
