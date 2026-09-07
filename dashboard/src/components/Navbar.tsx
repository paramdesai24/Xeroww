// src/components/Navbar.tsx
// Top navigation bar — Xeroww branding, API health indicator, market data disclaimer.
// Graphite-and-paper design system.

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
    <nav className="h-11 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] flex items-center px-4 justify-between shrink-0 z-20 font-mono">
      {/* Brand & Market Terminal Identifier */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest text-[var(--text-primary)] uppercase">
            Xeroww
          </span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-[11px] tracking-wider text-[var(--text-secondary)] uppercase">
            Market Terminal
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-[var(--surface-overlay)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
          V0.6
        </span>
      </div>

      {/* Right side telemetry */}
      <div className="flex items-center gap-4 text-xs">
        {/* Data disclaimer */}
        <div className="hidden sm:flex items-center gap-1.5 text-[var(--text-tertiary)] text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />
          <span>NSE FEED (15M DELAY)</span>
        </div>

        <div className="h-3 w-px bg-[var(--border-subtle)] hidden sm:block" />

        {/* Health indicator */}
        <div className="flex items-center gap-1.5">
          {healthy === null ? (
            <span className="text-[var(--text-tertiary)] text-[11px]">CONNECTING</span>
          ) : healthy ? (
            <div className="flex items-center gap-1.5 text-[var(--positive)] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)]" />
              <span>LIVE FEED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--negative)] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--negative)]" />
              <span>FEED OFFLINE</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
