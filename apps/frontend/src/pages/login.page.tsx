/**
 * LoginPage
 * ---------
 * Displays a single input field for the access code.
 * On success the token + account are stored in AuthContext.
 */

import { useState } from "react";
import { useAuth } from "../contexts/auth.context.js";
import { api } from "../lib/api.js";
import type { LoginResponse } from "@jlw/contracts";

export function LoginPage() {
  const { login } = useAuth();
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post<LoginResponse>("/auth/login", { accessCode });
      // Persist token and account in context (+ localStorage)
      login(res.token, res.account);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1a1a2e] px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold tracking-widest text-[#f4e4c1]">
          JLW 2026
        </h1>
        <p className="mt-1 text-sm tracking-wide text-[#cd7f32]">
          ⚔️ &nbsp;Jugendleiter-Weekend &nbsp;⚔️
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-xl border border-[#cd7f32]/30 bg-[#0d0d1a] p-8 shadow-2xl"
      >
        <h2 className="mb-6 text-center text-lg font-semibold text-[#f4e4c1]">
          Anmelden
        </h2>

        <label
          htmlFor="accessCode"
          className="mb-1 block text-xs font-medium uppercase tracking-widest text-[#cd7f32]"
        >
          Zugangscode
        </label>
        <input
          id="accessCode"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
          className="mt-1 w-full rounded-lg border border-[#cd7f32]/40 bg-[#1a1a2e] px-4 py-3 text-center
                     font-mono text-lg tracking-[0.4em] text-[#f4e4c1] placeholder-[#444]
                     outline-none transition focus:border-[#cd7f32] focus:ring-1 focus:ring-[#cd7f32]/50
                     disabled:opacity-50"
        />

        {/* Error message */}
        {error && (
          <p className="mt-3 rounded-md border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || !accessCode.trim()}
          className="mt-6 w-full rounded-lg bg-[#cd7f32] py-3 font-semibold tracking-wide
                     text-[#0d0d1a] transition hover:bg-[#e8943f] active:scale-95
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? "Anmelden…" : "Betreten"}
        </button>
      </form>

      <p className="mt-8 text-xs text-[#444]">© JLW 2026 – Nur für Teilnehmer</p>
    </div>
  );
}
