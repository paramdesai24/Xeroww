// src/components/ModuleNav.tsx
// Xeroww module navigator — graphite-and-paper design system.
// Quiet header with a single accent to indicate active state.

import type { UserProfile } from "../types/auth";

export type Module = "MARKET" | "WATCHLISTS" | "PORTFOLIO" | "ALERTS" | "JOURNAL" | "SYSTEM";

interface Props {
  activeModule: Module;
  onModuleChange: (m: Module) => void;
  user: UserProfile | null;
  onLogout: () => void;
  onLogin?: () => void;
  onOpenBreadth?: () => void;
}

const MODULES: Module[] = ["MARKET", "WATCHLISTS", "PORTFOLIO", "ALERTS", "JOURNAL", "SYSTEM"];

export default function ModuleNav({ activeModule, onModuleChange, user, onLogout, onLogin, onOpenBreadth }: Props) {
  return (
    <nav
      id="module-nav"
      className="flex items-center shrink-0"
      style={{
        minHeight: 38,
        backgroundColor: "var(--surface-base)",
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Brand — wordmark only, no glow */}
      <div
        className="px-5 flex items-center gap-2.5 shrink-0"
        style={{ height: 38, borderRight: "1px solid var(--border-subtle)" }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.18em",
            color: "var(--text-primary)",
          }}
        >
          XEROWW
        </span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.06em",
            color: "var(--text-disabled)",
          }}
        >
          V0.6
        </span>
      </div>

      {/* Module tabs */}
      <div className="flex items-center overflow-x-auto">
        {MODULES.map((mod) => {
          const active = activeModule === mod;
          return (
            <button
              key={mod}
              id={`module-tab-${mod.toLowerCase()}`}
              onClick={() => onModuleChange(mod)}
              style={{
                height: 38,
                padding: "0 16px",
                fontSize: 10,
                letterSpacing: "0.14em",
                fontWeight: 500,
                fontFamily: "var(--font-mono)",
                borderRight: "1px solid var(--border-subtle)",
                borderBottom: active ? `2px solid var(--accent)` : "2px solid transparent",
                backgroundColor: active ? "var(--surface-raised)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                transition: "color 160ms cubic-bezier(0.16,1,0.3,1), background-color 160ms cubic-bezier(0.16,1,0.3,1)",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
              }}
            >
              {mod}
            </button>
          );
        })}
      </div>

      {/* Market Breadth trigger */}
      {onOpenBreadth && (
        <button
          id="nav-breadth-btn"
          onClick={onOpenBreadth}
          style={{
            marginLeft: 12,
            padding: "4px 10px",
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.10em",
            fontFamily: "var(--font-mono)",
            border: "1px solid var(--border-default)",
            borderRadius: 2,
            backgroundColor: "transparent",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            transition: "color 160ms cubic-bezier(0.16,1,0.3,1), border-color 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
          }}
        >
          MARKET BREADTH
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User badge */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: 38, borderLeft: "1px solid var(--border-subtle)" }}
      >
        {user ? (
          <>
            <div className="flex items-center gap-2">
              {/* Presence indicator — muted green dot */}
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: "var(--positive)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {user.name.toUpperCase()}
              </span>
              <span style={{ color: "var(--border-strong)", fontSize: 10 }}>·</span>
              <span
                style={{
                  fontSize: 9,
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.1em",
                }}
              >
                {user.role}
              </span>
            </div>
            <button
              id="logout-btn"
              onClick={onLogout}
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                transition: "color 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--negative)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"}
            >
              SIGN OUT
            </button>
          </>
        ) : (
          <button
            id="login-btn"
            onClick={onLogin}
            style={{
              fontSize: 9,
              letterSpacing: "0.1em",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
              borderRadius: 2,
              background: "var(--accent-subtle)",
              padding: "4px 10px",
              cursor: "pointer",
              transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1), background-color 160ms cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(91,127,166,0.20)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)";
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-subtle)";
            }}
          >
            SIGN IN
          </button>
        )}
      </div>
    </nav>
  );
}
