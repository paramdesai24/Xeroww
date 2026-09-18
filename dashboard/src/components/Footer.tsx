// src/components/Footer.tsx
// Xeroww pipeline status rail — minimal, factual, never decorative.
// Real application health. Not marketing copy.

import { useEffect, useState } from "react";
import { api } from "../api/client";
import config from "../config";
import type { HealthStatus } from "../types/market";

export default function Footer() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [operational, setOperational] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const probe = () => {
      api.health()
        .then((h) => {
          if (active) {
            setHealth(h);
            setOperational(h.status === "healthy");
          }
        })
        .catch(() => {
          if (active) {
            setHealth(null);
            setOperational(false);
          }
        });
    };

    probe();
    const timer = setInterval(probe, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <footer
      className="h-7 bg-[#000000] border-t border-[#1E2538] flex items-center px-4 justify-between shrink-0 select-none text-[11px] font-mono text-[#64748B]"
    >
      <div className="flex items-center gap-3">
        <span>Feed: <span className="text-[#94A3B8] font-medium">{health?.data_provider ?? "Yahoo Finance"}</span></span>
        <span className="text-[#334155]">·</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              operational ? "bg-[#22C55E]" : "bg-[#EF4444]"
            }`}
          />
          <span className={operational ? "text-[#22C55E] font-medium" : "text-[#EF4444] font-medium"}>
            Engine: {operational ? "Operational" : "Degraded"}
          </span>
        </span>
        <span className="text-[#334155]">·</span>
        <span>DB: <span className={operational ? "text-[#94A3B8]" : "text-[#EF4444]"}>{operational ? "Connected" : "Unreachable"}</span></span>
        <span className="text-[#334155]">·</span>
        <span className="text-[#64748B]">v{config.app.version}</span>
      </div>

      <div className="hidden md:flex items-center gap-2 text-[#475569]">
        <span>Xeroww Quantitative Workstation</span>
        <span className="text-[#334155]">·</span>
        <span>Deterministic Empirical Analysis</span>
      </div>
    </footer>
  );
}
