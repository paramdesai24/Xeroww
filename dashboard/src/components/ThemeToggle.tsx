import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/context";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Use ${next} theme`} title={`Use ${next} theme`}>
    {resolvedTheme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
  </button>;
}
