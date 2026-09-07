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
      {/* Brand & Market Terminal Identifier */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            Xeroww
          </span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-xs text-[var(--text-secondary)]">
            Market Terminal
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-[var(--surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-default)]">
          v0.6
        </span>
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
