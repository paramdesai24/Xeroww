// src/components/Footer.tsx
// Xeroww pipeline status rail — minimal, factual, never decorative.
// Real application health. Not marketing copy.

import { useEffect, useState } from "react";
import { api } from "../api/client";
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
      className="status-footer bg-[#000000] border-t border-[#1E2538] flex items-center px-4 justify-between shrink-0 select-none text-label font-mono text-[#64748B]"
    >
      <div className="status-footer__primary flex items-center gap-3">
        <span className="status-footer__provider">Feed: <span className="text-[#94A3B8] font-medium">{health?.data_provider ?? "Yahoo Finance"}</span></span>
        <span className="status-footer__separator text-[#334155]">·</span>
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
        <span className="status-footer__separator text-[#334155]">·</span>
        <span className="status-footer__database">DB: <span className={operational ? "text-[#94A3B8]" : "text-[#EF4444]"}>{operational ? "Connected" : "Unreachable"}</span></span>
      </div>

      <div className="status-footer__secondary hidden md:flex items-center gap-2 text-[#475569]">
        <span>Xeroww Quantitative Workstation</span>
        <span className="text-[#334155]">·</span>
        <span>Deterministic Empirical Analysis</span>
      </div>
    </footer>
  );
}
