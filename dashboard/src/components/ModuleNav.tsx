// src/components/ModuleNav.tsx
// Institutional terminal module navigator — switches between platform modules.
// Zero generic SaaS styling. Dense, high-contrast, terminal-identity.

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
      className="flex items-center border-b border-[#1E1E1E] bg-[#000] shrink-0"
      style={{ minHeight: 38, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* Brand */}
      <div className="px-4 border-r border-[#1E1E1E] flex items-center gap-2 shrink-0" style={{ height: 38 }}>
        <span className="text-[#00E5FF] text-[10px] font-bold tracking-[0.25em]">XEROWW</span>
        <span className="text-[#252525] text-[10px]">V0.6</span>
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
              className={`px-4 text-[10px] tracking-[0.2em] font-bold transition-colors border-r border-[#1A1A1A] shrink-0 ${
                active
                  ? "text-[#00E5FF] bg-[#0a1015]"
                  : "text-[#3a3a3a] hover:text-[#666] bg-[#000]"
              }`}
              style={{ height: 38 }}
            >
              {mod}
            </button>
          );
        })}
      </div>

      {/* Market Breadth & Correlation quick trigger */}
      {onOpenBreadth && (
        <button
          id="nav-breadth-btn"
          onClick={onOpenBreadth}
          className="ml-3 px-2 py-1 text-[10px] font-bold tracking-wider border border-[#222] hover:border-[#00E5FF] text-[#888] hover:text-[#00E5FF] bg-[#050505] transition-colors"
        >
          MARKET BREADTH
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />


      {/* User badge */}
      <div className="flex items-center gap-3 px-4 border-l border-[#1E1E1E] shrink-0" style={{ height: 38 }}>
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[#525252] text-[10px] tracking-wider">
                {user.name.toUpperCase()}
              </span>
              <span className="text-[#2a2a2a] text-[10px]">·</span>
              <span className="text-[#333] text-[10px] tracking-widest">{user.role}</span>
            </div>
            <button
              id="logout-btn"
              onClick={onLogout}
              className="text-[10px] tracking-wider text-[#333] hover:text-[#ff4d4d] transition-colors px-2"
            >
              LOGOUT
            </button>
          </>
        ) : (
          <button
            id="login-btn"
            onClick={onLogin}
            className="text-[#00E5FF] hover:text-[#33EAFF] text-[10px] tracking-widest font-bold px-2 py-1 border border-[#00E5FF]/40 hover:border-[#00E5FF] bg-[#00E5FF]/5 transition-colors"
          >
            SIGN IN / REGISTER
          </button>
        )}
      </div>
    </nav>
  );
}
