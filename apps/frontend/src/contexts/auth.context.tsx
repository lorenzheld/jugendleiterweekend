/**
 * AuthContext
 * -----------
 * Provides the current authentication state (token + account info) to the
 * entire React tree. Persists to localStorage so the session survives page
 * reloads within the JWT lifetime (7 days).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { LoginResponse, MeResponse } from "@jlw/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  account: LoginResponse["account"] | null;
  /** Full player + team profile, loaded after login via /me. */
  profile: MeResponse | null;
}

interface AuthContextValue extends AuthState {
  /** Called after a successful /login response. Persists to localStorage. */
  login: (token: string, account: LoginResponse["account"]) => void;
  /** Called after /me resolves. Enriches the context with player/team data. */
  setProfile: (profile: MeResponse) => void;
  /** Clears state and localStorage. */
  logout: () => void;
  isAuthenticated: boolean;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const TOKEN_KEY = "jlw_token";
const ACCOUNT_KEY = "jlw_account";

function readStorage(): Pick<AuthState, "token" | "account"> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(ACCOUNT_KEY);
    const account = raw ? (JSON.parse(raw) as LoginResponse["account"]) : null;
    return { token, account };
  } catch {
    return { token: null, account: null };
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    ...readStorage(),
    profile: null,
  }));

  const login = useCallback(
    (token: string, account: LoginResponse["account"]) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      setState({ token, account, profile: null });
    },
    [],
  );

  const setProfile = useCallback((profile: MeResponse) => {
    setState((prev) => ({ ...prev, profile }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    setState({ token: null, account: null, profile: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.token !== null,
      login,
      setProfile,
      logout,
    }),
    [state, login, setProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Convenience hook – throws if used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
