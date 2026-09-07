// src/components/AuthModal.tsx
// Authentication modal — graphite-and-paper design system.
// Clean, functional form. No decoration.

import { useState } from "react";
import type { AuthHook } from "../hooks/useAuth";

interface Props {
  auth: AuthHook;
  onClose?: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--surface-inset)",
  border: "1px solid var(--border-default)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "8px 12px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--text-tertiary)",
  marginBottom: 5,
};

export default function AuthModal({ auth, onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await auth.login(email, password);
      } else {
        if (!name.trim()) { setLocalError("Display name is required."); return; }
        await auth.register(name, email, password);
      }
      onClose?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorMsg = localError || auth.error;

  return (
    <div
      id="auth-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
      }}
    >
      <div
        id="auth-modal"
        style={{
          width: "100%",
          maxWidth: 380,
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--surface-raised)",
        }}
      >
        {/* Header */}
        <div style={{
          borderBottom: "1px solid var(--border-subtle)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", color: "var(--text-primary)" }}>
                XEROWW
              </span>
              <span style={{ color: "var(--border-strong)", fontSize: 10 }}>·</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                Financial Intelligence Platform
              </span>
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {mode === "login" ? "Sign In" : "Create Account"}
            </div>
          </div>
          {onClose && (
            <button
              id="close-auth-modal"
              type="button"
              onClick={onClose}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                color: "var(--text-tertiary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                transition: "color 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"}
            >
              [ESC]
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
          {(["login", "register"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                id={`auth-tab-${m}`}
                onClick={() => { setMode(m); setLocalError(null); }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  border: "none",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  backgroundColor: active ? "var(--surface-overlay)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-disabled)",
                  transition: "all 160ms cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={{ ...inputStyle, borderColor: focusedField === "name" ? "var(--border-strong)" : "var(--border-default)" }}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@example.com"
              style={{ ...inputStyle, borderColor: focusedField === "email" ? "var(--border-strong)" : "var(--border-default)" }}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Min 8 chars, uppercase + number" : "••••••••"}
              style={{ ...inputStyle, borderColor: focusedField === "password" ? "var(--border-strong)" : "var(--border-default)" }}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {errorMsg && (
            <div
              id="auth-error"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 10,
                lineHeight: 1.6,
                color: "var(--negative)",
                border: "1px solid var(--negative-border)",
                backgroundColor: "var(--negative-subtle)",
                padding: "7px 10px",
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            id="auth-submit"
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "10px 0",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: submitting ? "not-allowed" : "pointer",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--surface-overlay)",
              color: submitting ? "var(--text-disabled)" : "var(--text-primary)",
              opacity: submitting ? 0.5 : 1,
              transition: "border-color 160ms cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; }}
          >
            {submitting ? "Processing…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "10px 20px",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.06em", color: "var(--text-disabled)", margin: 0 }}>
            XEROWW V0.6 · SIMULATED PORTFOLIOS · NO REAL TRADES
          </p>
        </div>
      </div>
    </div>
  );
}
