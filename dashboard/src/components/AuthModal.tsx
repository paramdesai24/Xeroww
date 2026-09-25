// src/components/AuthModal.tsx
// Authentication modal — graphite-and-paper design system.
// Clean, functional form. No decoration.

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-none p-4 select-none"
    >
      <div
        id="auth-modal"
        className="w-full max-w-sm border border-[#1E2538] bg-[#000000] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-[#1E2538] p-5 flex items-start justify-between bg-[#0B0E14]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1E90FF] tracking-wider font-mono">
                XEROWW
              </span>
              <span className="text-[#334155] text-xs">·</span>
              <span className="text-xs text-[#64748B]">
                Quantitative Workstation
              </span>
            </div>
            <div className="text-base font-semibold text-[#F8FAFC]">
              {mode === "login" ? "Sign in to workspace" : "Create quant workspace"}
            </div>
          </div>
          {onClose && (
            <button
              id="close-auth-modal"
              type="button"
              onClick={onClose}
              className="text-xs text-[#64748B] hover:text-[#F8FAFC] font-mono p-1 transition-colors"
            >
              [ESC]
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-[#1E2538] bg-[#05070B]">
          {(["login", "register"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                id={`auth-tab-${m}`}
                onClick={() => { setMode(m); setLocalError(null); }}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? "text-[#F8FAFC] bg-[#0B0E14] border-b-2 border-b-[#1E90FF]"
                    : "text-[#64748B] hover:text-[#94A3B8] border-b-2 border-b-transparent"
                }`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5 bg-[#000000]">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Display Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Alan Turing"
                className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-3 py-2 outline-none placeholder-[#64748B] transition-colors"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Email Address</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@xeroww.internal"
              className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-3 py-2 outline-none placeholder-[#64748B] transition-colors"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Min 8 chars, uppercase + digit" : "••••••••"}
              className="w-full bg-[#10141D] border border-[#1E2538] focus:border-[#3B82F6] text-[#F8FAFC] text-xs px-3 py-2 outline-none placeholder-[#64748B] transition-colors"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {errorMsg && (
            <div
              id="auth-error"
              className="text-xs text-[#EF4444] border border-[#EF4444]/20 bg-[#EF4444]/10 p-2.5 leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          <button
            id="auth-submit"
            type="submit"
            disabled={submitting}
            className="w-full mt-1 py-2.5 text-xs font-semibold bg-[#1E90FF] hover:bg-[#1C86EE] text-white transition-colors disabled:opacity-50"
          >
            {submitting ? "Processing…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="border-t border-[#1E2538] px-5 py-2.5 bg-[#05070B]">
          <p className="text-label text-[#64748B] font-mono m-0">
            XEROWW · SIMULATED PORTFOLIOS · AUDIT COMPLIANT
          </p>
        </div>
      </div>
    </div>
  );
}
