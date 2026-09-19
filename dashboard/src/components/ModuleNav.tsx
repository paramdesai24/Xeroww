// src/components/ModuleNav.tsx
// Xeroww workspace navigation — v2 natural typography & vivid amber active indicator.

import type { UserProfile } from "../types/auth";
import config from "../config";

export type Module = "MARKET" | "WATCHLISTS" | "PORTFOLIO" | "ALERTS" | "JOURNAL" | "SYSTEM";

interface Props {
  activeModule: Module;
  onModuleChange: (m: Module) => void;
  user: UserProfile | null;
  onLogout: () => void;
  onLogin?: () => void;
  onOpenBreadth?: () => void;
}

const MODULE_CONFIG: { id: Module; label: string }[] = [
  { id: "MARKET", label: "Market" },
  { id: "WATCHLISTS", label: "Watchlists" },
  { id: "PORTFOLIO", label: "Portfolio" },
  { id: "ALERTS", label: "Alerts" },
  { id: "JOURNAL", label: "Journal" },
  { id: "SYSTEM", label: "System" },
];

export default function ModuleNav({
  activeModule,
  onModuleChange,
  user,
  onLogout,
  onLogin,
  onOpenBreadth,
}: Props) {
  return (
    <nav
      id="module-nav"
      className="module-nav shrink-0 border-b border-[var(--border-default)] select-none"
      style={{
        backgroundColor: "var(--canvas)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Brand & Version */}
      <div className="module-nav__brand flex items-center gap-2.5 shrink-0 border-r border-[var(--border-default)]">
        <img
          src="/xeroww-logo.png"
          alt="Xeroww"
          className="module-nav__logo module-nav__logo--compact"
          width="1254"
          height="1254"
        />
        <img
          src="/xeroww-logo-long.png"
          alt="Xeroww"
          className="module-nav__logo module-nav__logo--full"
          width="2172"
          height="724"
        />
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-sm bg-[var(--surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-default)]">
          v{config.app.version}
        </span>
      </div>

      {/* Module tabs with natural title case */}
      <div className="module-nav__tabs flex items-center overflow-x-auto">
        {MODULE_CONFIG.map(({ id, label }) => {
          const active = activeModule === id;
          return (
            <button
              key={id}
              id={`module-tab-${id.toLowerCase()}`}
              onClick={() => onModuleChange(id)}
              className={`module-nav__tab h-full px-4 text-[13px] font-medium flex items-center border-r border-[var(--border-default)] transition-colors duration-150 relative ${
                active
                  ? "text-[var(--text-primary)] bg-[var(--surface)] font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50"
              }`}
            >
              {label}
              {active && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: "var(--accent-primary)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Market Breadth trigger */}
      {onOpenBreadth && (
        <button
          id="nav-breadth-btn"
          onClick={onOpenBreadth}
          className="module-nav__breadth ml-3 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors duration-150 rounded-sm bg-[var(--surface)]"
        >
          Market Breadth
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Session status */}
      <div className="module-nav__session flex items-center gap-3 px-4 shrink-0 border-l border-[var(--border-default)]">
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--positive)] shrink-0" />
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {user.name}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">({user.role})</span>
            </div>
            <button
              id="logout-btn"
              onClick={onLogout}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--negative)] transition-colors duration-150"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            id="login-btn"
            onClick={onLogin}
            className="px-3 py-1 text-xs font-semibold text-[var(--accent-primary)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] hover:border-[var(--accent-primary)] transition-colors duration-150 rounded-sm"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
