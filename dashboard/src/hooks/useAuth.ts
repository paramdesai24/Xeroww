// src/hooks/useAuth.ts
// Authentication state hook — manages JWT tokens and current user profile.

import { useState, useEffect, useCallback } from "react";
import { api, storeTokens, clearTokens, getStoredToken, REFRESH_KEY } from "../api/client";
import type { UserProfile } from "../types/auth";

export interface AuthHook {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.auth
      .me()
      .then(setUser)
      .catch(() => {
        // Token expired or invalid — try refresh
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (refreshToken) {
          api.auth
            .refresh(refreshToken)
            .then((tokens) => {
              storeTokens(tokens.access_token, tokens.refresh_token);
              return api.auth.me();
            })
            .then(setUser)
            .catch(() => {
              clearTokens();
              setUser(null);
            });
        } else {
          clearTokens();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const tokens = await api.auth.login(email, password);
      storeTokens(tokens.access_token, tokens.refresh_token);
      const profile = await api.auth.me();
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const tokens = await api.auth.register(name, email, password);
      storeTokens(tokens.access_token, tokens.refresh_token);
      const profile = await api.auth.me();
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.auth.logout().catch(() => {});
    clearTokens();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}
