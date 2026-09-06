// src/components/Footer.tsx
// Signature Xeroww Pipeline Status Footer — minimal institutional metadata rail.
// Reflects genuine application health without fabricated claims.

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
    <footer className="h-6 bg-[#0A0A0A] border-t border-[#262626] flex items-center px-4 justify-between shrink-0 select-none font-mono text-[11px] text-[#737373]">
      <div className="flex items-center gap-2">
        <span className="text-[#A1A1AA]">FEED: {health?.data_provider ?? "YAHOO PROVIDER"}</span>
        <span className="text-[#333333]">|</span>
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              operational ? "bg-[#22C55E]" : "bg-[#EF4444]"
            }`}
          />
          <span className={operational ? "text-[#22C55E]" : "text-[#EF4444]"}>
            ANALYTICS: {operational ? "HEALTHY" : "DEGRADED (OFFLINE)"}
          </span>
        </span>
        <span className="text-[#333333]">|</span>
        <span>DATABASE: {operational ? "CONNECTED" : "UNREACHABLE"}</span>
        <span className="text-[#333333]">|</span>
        <span>VERSION: V0.6</span>
      </div>

      <div className="hidden md:flex items-center gap-2 text-[10px] text-[#555555]">
        <span>XEROWW DETERMINISTIC ENGINE</span>
        <span className="text-[#333333]">·</span>
        <span>NO ML / ZERO PREDICTION</span>
      </div>
    </footer>
  );
}

