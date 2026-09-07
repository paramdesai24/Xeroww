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

  const separator = (
    <span style={{ color: "var(--border-strong)", margin: "0 8px" }}>·</span>
  );

  return (
    <footer
      style={{
        height: 24,
        backgroundColor: "var(--surface-base)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 16,
        justifyContent: "space-between",
        flexShrink: 0,
        userSelect: "none",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        color: "var(--text-tertiary)",
        letterSpacing: "0.06em",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span>FEED: {health?.data_provider ?? "YAHOO"}</span>
        {separator}
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: operational ? "var(--positive)" : "var(--negative)",
              flexShrink: 0,
            }}
          />
          <span style={{ color: operational ? "var(--positive)" : "var(--negative)" }}>
            ANALYTICS: {operational ? "HEALTHY" : "DEGRADED"}
          </span>
        </span>
        {separator}
        <span>DB: {operational ? "CONNECTED" : "UNREACHABLE"}</span>
        {separator}
        <span>V0.6</span>
      </div>

      <div
        className="hidden md:flex"
        style={{ alignItems: "center", gap: 6, color: "var(--text-disabled)" }}
      >
        <span>XEROWW DETERMINISTIC ENGINE</span>
        <span style={{ color: "var(--border-strong)" }}>·</span>
        <span>NO ML / ZERO PREDICTION</span>
      </div>
    </footer>
  );
}
