import type { UserProfile } from "../types/auth";
import GlobalSearch from "./GlobalSearch";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "../theme/context";

export type Module = "HOME" | "MARKETS" | "STOCK" | "WATCHLISTS" | "PORTFOLIO" | "REPLAY" | "ALERTS" | "JOURNAL" | "SETTINGS";

interface Props {
  activeModule: Module;
  onModuleChange: (module: Module) => void;
  onOpenSymbol: (symbol: string) => void;
  onOpenBreadth?: () => void;
  user: UserProfile | null;
  onLogout: () => void;
  onLogin?: () => void;
}

const PRIMARY: Array<{ id: Module; label: string }> = [
  { id: "HOME", label: "Home" },
  { id: "MARKETS", label: "Markets" },
  { id: "WATCHLISTS", label: "Watchlists" },
  { id: "PORTFOLIO", label: "Portfolio" },
  { id: "JOURNAL", label: "Decisions" },
];

export default function ModuleNav({ activeModule, onModuleChange, onOpenSymbol, onOpenBreadth, user, onLogout, onLogin }: Props) {
  const { resolvedTheme } = useTheme();
  const compactLogo = resolvedTheme === "light" ? "/xeroww-logo-light.png" : "/xeroww-logo.png";
  const fullLogo = resolvedTheme === "light" ? "/xeroww-logo-long-light.png" : "/xeroww-logo-long.png";

  return <nav id="module-nav" className="module-nav" aria-label="Primary navigation">
    <button className="module-nav__brand" type="button" onClick={() => onModuleChange("HOME")} aria-label="Xeroww home">
      <img src={compactLogo} alt="" className="module-nav__logo module-nav__logo--compact" />
      <img src={fullLogo} alt="Xeroww" className="module-nav__logo module-nav__logo--full" />
    </button>
    <div className="module-nav__tabs">
      {PRIMARY.map(({ id, label }) => <button key={id} type="button" onClick={() => onModuleChange(id)} className={`module-nav__tab${activeModule === id ? " is-active" : ""}`} aria-current={activeModule === id ? "page" : undefined}>{label}</button>)}
    </div>
    <div className="module-nav__tools">
      <GlobalSearch onOpenSymbol={onOpenSymbol} />
      <button className={`module-nav__utility${activeModule === "ALERTS" ? " is-active" : ""}`} onClick={() => onModuleChange("ALERTS")}>Alerts</button>
      <button className={`module-nav__utility${activeModule === "REPLAY" ? " is-active" : ""}`} onClick={() => onModuleChange("REPLAY")}>Replay</button>
      {onOpenBreadth && <button className="module-nav__utility" type="button" onClick={onOpenBreadth}>Breadth</button>}
      <ThemeToggle />
      {user ? <div className="module-nav__profile"><button type="button" onClick={() => onModuleChange("SETTINGS")} aria-label="Open settings"><span className="module-nav__avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}<span className="module-nav__presence" /></span>{user.name}</button><button type="button" onClick={onLogout}>Sign out</button></div>
        : <button id="login-btn" className="module-nav__signin" type="button" onClick={onLogin}>Sign in</button>}
    </div>
  </nav>;
}
