// src/components/Footer.tsx
// Xeroww pipeline status rail: minimal, factual, never decorative.
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
    <footer className="status-footer">
      <div className="status-footer__primary">
        <span className="status-footer__provider"><span className="status-footer__label">Feed</span><span className="status-footer__value">{health?.data_provider ?? "Yahoo Finance"}</span></span>
        <span className="status-footer__separator" aria-hidden="true">·</span>
        <span className="status-footer__state" role="status">
          <span className={`status-footer__dot ${operational ? "is-operational" : "is-degraded"}`} />
          <span className="status-footer__label">Engine</span>
          <span className="status-footer__value">{operational ? "Operational" : "Degraded"}</span>
        </span>
        <span className="status-footer__separator" aria-hidden="true">·</span>
        <span className="status-footer__database"><span className="status-footer__label">DB</span><span className="status-footer__value">{operational ? "Connected" : "Unreachable"}</span></span>
      </div>

      <div className="status-footer__secondary">
        <span>Xeroww Quantitative Workstation</span>
        <span className="status-footer__separator" aria-hidden="true">·</span>
        <span>Deterministic Empirical Analysis</span>
      </div>
    </footer>
  );
}
