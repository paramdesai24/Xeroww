import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type ResolvedTheme, type ThemeContextValue, type ThemePreference } from "./context";

const STORAGE_KEY = "xeroww:theme";
function savedPreference(): ThemePreference {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function systemTheme(): ResolvedTheme {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(savedPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);
  const resolvedTheme = preference === "system" ? system : preference;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystem(media.matches ? "light" : "dark");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    setPreference: (next) => {
      localStorage.setItem(STORAGE_KEY, next);
      setPreferenceState(next);
    },
    toggleTheme: () => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      setPreferenceState(next);
    },
  }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
