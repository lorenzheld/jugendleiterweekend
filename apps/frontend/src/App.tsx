/**
 * App – Root shell / client-side router.
 *
 * Screens (simple state machine – no router dependency needed for Epic 2):
 *   "login"  →  LoginPage   (unauthenticated)
 *   "lobby"  →  LobbyPage   (authenticated, before entering the game world)
 *   "map"    →  GameMap     (authenticated, active play)
 *
 * The AuthProvider is mounted here so all child components can use useAuth().
 */

import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/auth.context.js";
import { LoginPage } from "./pages/login.page.js";
import { LobbyPage } from "./pages/lobby.page.js";
import { GameMap } from "./components/map/game-map.js";

// ── Screen type ───────────────────────────────────────────────────────────────

type Screen = "login" | "lobby" | "map";

// ── Inner shell (needs AuthContext) ──────────────────────────────────────────

function AppShell() {
  const { isAuthenticated } = useAuth();

  // Determine initial screen from persisted auth state
  const [screen, setScreen] = useState<Screen>(() =>
    isAuthenticated ? "lobby" : "login",
  );

  // Sync screen state with auth state:
  // - If token disappears (logout / localStorage cleared) → back to login
  // - If token appears while on login screen (login succeeded) → to lobby
  useEffect(() => {
    if (!isAuthenticated) {
      setScreen("login");
    } else if (isAuthenticated && screen === "login") {
      setScreen("lobby");
    }
  }, [isAuthenticated]); // intentionally omit `screen` to avoid loop

  // Callback fired by LobbyPage when "Zur Karte" is pressed
  function handleEnterMap() {
    setScreen("map");
  }

  // Callback fired by GameMap to return to lobby
  function handleBackToLobby() {
    setScreen("lobby");
  }

  switch (screen) {
    case "login":
      return <LoginPage />;

    case "lobby":
      if (!isAuthenticated) {
        // Guard: should not happen, but be defensive
        return <LoginPage />;
      }
      return <LobbyPage onEnterMap={handleEnterMap} />;

    case "map":
      if (!isAuthenticated) {
        return <LoginPage />;
      }
      return <GameMap onBack={handleBackToLobby} />;
  }
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
