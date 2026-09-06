// src/components/AuthModal.tsx
// Institutional-grade authentication modal — login & registration.
// Maintains the black terminal aesthetic.

import { useState } from "react";
import type { AuthHook } from "../hooks/useAuth";

interface Props {
  auth: AuthHook;
  onClose?: () => void;
}

export default function AuthModal({ auth, onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await auth.login(email, password);
      } else {
        if (!name.trim()) {
          setLocalError("Name is required.");
          return;
        }
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        id="auth-modal"
        className="w-full max-w-sm border border-[#262626] bg-[#0A0A0A]"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {/* Header */}
        <div className="border-b border-[#262626] px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#00E5FF] text-xs font-bold tracking-[0.2em]">XEROWW</span>
              <span className="text-[#3a3a3a] text-xs">|</span>
              <span className="text-[#525252] text-xs tracking-widest">FINANCIAL INTELLIGENCE PLATFORM</span>
            </div>
            <div className="mt-2 text-[#FAFAFA] text-sm tracking-wider font-bold">
              {mode === "login" ? "AUTHENTICATE" : "CREATE ACCOUNT"}
            </div>
          </div>
          {onClose && (
            <button
              id="close-auth-modal"
              type="button"
              onClick={onClose}
              className="text-[#666] hover:text-[#FFF] text-sm font-mono px-2 py-1"
            >
              [ESC]
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-[#262626]">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              id={`auth-tab-${m}`}
              onClick={() => { setMode(m); setLocalError(null); }}
              className={`flex-1 py-2.5 text-xs tracking-widest font-bold transition-colors ${
                mode === m
                  ? "bg-[#111] text-[#00E5FF] border-b border-[#00E5FF]"
                  : "text-[#525252] hover:text-[#888]"
              }`}
            >
              {m === "login" ? "LOGIN" : "REGISTER"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">
                DISPLAY NAME
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-[#111] border border-[#2a2a2a] text-[#FAFAFA] text-xs px-3 py-2.5 outline-none focus:border-[#00E5FF] placeholder-[#333] transition-colors"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">
              EMAIL ADDRESS
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@example.com"
              className="w-full bg-[#111] border border-[#2a2a2a] text-[#FAFAFA] text-xs px-3 py-2.5 outline-none focus:border-[#00E5FF] placeholder-[#333] transition-colors"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest text-[#525252] mb-1.5">
              PASSWORD
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Min 8 chars, uppercase + number" : "••••••••"}
              className="w-full bg-[#111] border border-[#2a2a2a] text-[#FAFAFA] text-xs px-3 py-2.5 outline-none focus:border-[#00E5FF] placeholder-[#333] transition-colors"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {errorMsg && (
            <div
              id="auth-error"
              className="text-[10px] text-[#ff4d4d] border border-[#3a1818] bg-[#1a0a0a] px-3 py-2 tracking-wide"
            >
              {errorMsg}
            </div>
          )}

          <button
            id="auth-submit"
            type="submit"
            disabled={submitting}
            className="w-full bg-[#00E5FF] text-black text-xs font-bold tracking-widest py-2.5 disabled:opacity-40 hover:bg-[#00cfea] transition-colors"
          >
            {submitting ? "PROCESSING..." : mode === "login" ? "AUTHENTICATE" : "CREATE ACCOUNT"}
          </button>
        </form>

        <div className="border-t border-[#1a1a1a] px-6 py-3">
          <p className="text-[10px] text-[#303030] tracking-wider">
            XEROWW V0.6 · SIMULATED PORTFOLIOS · NO REAL TRADES
          </p>
        </div>
      </div>
    </div>
  );
}
