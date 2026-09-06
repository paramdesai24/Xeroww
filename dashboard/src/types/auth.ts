// src/types/auth.ts
// Authentication and user domain type definitions

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_minutes: number;
}

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
