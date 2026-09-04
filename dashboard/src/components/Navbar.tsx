// src/components/Navbar.tsx
// Top navigation bar — Xeroww branding, API health indicator, market data disclaimer.

import { useEffect, useState } from "react";
import { Activity, TrendingUp, Wifi, WifiOff } from "lucide-react";
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
    <nav className="h-14 bg-[#0B0F19] border-b border-slate-800 flex items-center px-6 justify-between shrink-0 z-10">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <TrendingUp size={16} className="text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white font-bold text-lg tracking-tight">Xeroww</span>
          <span className="text-slate-500 text-xs font-medium uppercase tracking-widest">Market Terminal</span>
        </div>
        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          V0
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Data disclaimer */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
          <Activity size={12} className="text-amber-400" />
          <span>Near real-time data — 15–20 min delay (NSE)</span>
        </div>

        {/* Health indicator */}
        <div className="flex items-center gap-1.5">
          {healthy === null ? (
            <span className="text-slate-500 text-xs">Connecting…</span>
          ) : healthy ? (
            <>
              <Wifi size={13} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium">API Online</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-red-400" />
              <span className="text-red-400 text-xs font-medium">API Offline</span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
