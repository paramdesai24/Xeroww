import { Link } from "react-router-dom";
import { useTheme, type ThemePreference } from "../theme/context";

export default function SettingsPage() {
  const { preference, setPreference } = useTheme();
  return <main className="workspace-page"><header className="workspace-header"><div><p className="decision-eyebrow">Preferences</p><h1>Settings</h1><p>Choose how Xeroww appears on this device.</p></div></header><section className="workspace-panel settings-panel"><div className="workspace-panel__header"><div><h2>Theme</h2><span>Applied across public and authenticated workspaces</span></div></div><div className="settings-options">{(["light", "dark", "system"] as ThemePreference[]).map((item) => <button key={item} type="button" className={preference === item ? "is-active" : ""} onClick={() => setPreference(item)}><strong>{item[0].toUpperCase() + item.slice(1)}</strong><span>{item === "system" ? "Follow this device" : `Always use ${item} mode`}</span></button>)}</div><Link className="decision-secondary-action" to="/settings/system">System health</Link></section></main>;
}
