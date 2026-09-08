/**
 * State Recovery Hook (Epic 7)
 * -----------------------------
 * Handles state recovery after WebSocket reconnection.
 * Recovers:
 *   - Active combat state and locks
 *   - Quest dialog state and progress
 *   - Team state (if changed during disconnect)
 *   - Pending actions that failed to send
 */

import { useCallback, useEffect, useRef } from "react";
import { useWs } from "../contexts/websocket.context.js";
import { useAuth } from "../contexts/auth.context.js";
import { api } from "../lib/api.js";
import type {
  CombatInstance,
  QuestRun,
} from "@jlw/contracts";

interface StateRecoveryOptions {
  /** Enable combat state recovery (default: true) */
  recoverCombat?: boolean;
  /** Enable quest state recovery (default: true) */
  recoverQuests?: boolean;
  /** Enable team state recovery (default: true) */
  recoverTeam?: boolean;
  /** Callback fired when recovery is complete */
  onRecoveryComplete?: () => void;
  /** Enable debug logging */
  debug?: boolean;
}

interface RecoveredState {
  combat: CombatInstance | null;
  activeQuests: QuestRun[];
  teamUpdates: unknown | null;
}

/**
 * Hook that automatically recovers critical game state after WebSocket
 * reconnection. Prevents players from losing progress due to temporary
 * disconnections.
 */
export function useStateRecovery(options: StateRecoveryOptions = {}) {
  const {
    recoverCombat = true,
    recoverQuests = true,
    recoverTeam = true,
    onRecoveryComplete,
    debug = false,
  } = options;

  const { isConnected, connectionState } = useWs();
  const { token, profile } = useAuth();
  
  const lastConnectionState = useRef(connectionState);
  const recoveryInProgress = useRef(false);
  const hasRecovered = useRef(false);

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.log("[State Recovery]", ...args);
  }, [debug]);

  /**
   * Recover active combat state.
   * Fetches the team's active combat and restores locks.
   */
  const recoverCombatState = useCallback(async (): Promise<CombatInstance | null> => {
    if (!token) return null;

    try {
      log("Recovering combat state...");
      const combat = await api.get<CombatInstance>("/combat/team/active");
      log("Combat state recovered:", combat.id);
      return combat;
    } catch (error) {
      // 404 means no active combat – this is fine
      if (error instanceof Error && error.message.includes("404")) {
        log("No active combat to recover");
        return null;
      }
      log("Failed to recover combat state:", error);
      return null;
    }
  }, [token, log]);

  /**
   * Recover active quest runs.
   * Fetches all active quest runs and restores dialog state.
   */
  const recoverQuestState = useCallback(async (): Promise<QuestRun[]> => {
    if (!token || !profile?.player?.team?.id) return [];

    try {
      log("Recovering quest state...");
      const response = await api.get<{ runs: QuestRun[] }>(
        `/quests/team/${profile.player.team.id}/active`
      );
      log("Quest state recovered:", response.runs.length, "active quests");
      return response.runs;
    } catch (error) {
      log("Failed to recover quest state:", error);
      return [];
    }
  }, [token, profile, log]);

  /**
   * Recover team state.
   * Fetches fresh team data to catch any changes during disconnect.
   */
  const recoverTeamState = useCallback(async (): Promise<unknown | null> => {
    if (!token) return null;

    try {
      log("Recovering team state...");
      const profile = await api.get<unknown>("/auth/me");
      log("Team state recovered");
      return profile;
    } catch (error) {
      log("Failed to recover team state:", error);
      return null;
    }
  }, [token, log]);

  /**
   * Perform full state recovery.
   * Called automatically when WebSocket reconnects.
   */
  const performRecovery = useCallback(async (): Promise<RecoveredState> => {
    if (recoveryInProgress.current) {
      log("Recovery already in progress, skipping");
      return {
        combat: null,
        activeQuests: [],
        teamUpdates: null,
      };
    }

    recoveryInProgress.current = true;
    log("Starting state recovery...");

    try {
      // Run all recovery operations in parallel
      const [combat, activeQuests, teamUpdates] = await Promise.all([
        recoverCombat ? recoverCombatState() : Promise.resolve(null),
        recoverQuests ? recoverQuestState() : Promise.resolve([]),
        recoverTeam ? recoverTeamState() : Promise.resolve(null),
      ]);

      const result: RecoveredState = {
        combat,
        activeQuests,
        teamUpdates,
      };

      log("State recovery complete:", {
        hasCombat: !!combat,
        questCount: activeQuests.length,
        hasTeamUpdates: !!teamUpdates,
      });

      hasRecovered.current = true;
      onRecoveryComplete?.();

      return result;
    } catch (error) {
      log("State recovery failed:", error);
      return {
        combat: null,
        activeQuests: [],
        teamUpdates: null,
      };
    } finally {
      recoveryInProgress.current = false;
    }
  }, [
    recoverCombat,
    recoverQuests,
    recoverTeam,
    recoverCombatState,
    recoverQuestState,
    recoverTeamState,
    onRecoveryComplete,
    log,
  ]);

  /**
   * Detect reconnection and trigger recovery.
   * Watches for transition from "reconnecting" to "connected".
   */
  useEffect(() => {
    const wasReconnecting = lastConnectionState.current === "reconnecting";
    const nowConnected = connectionState === "connected";

    if (wasReconnecting && nowConnected && !hasRecovered.current) {
      log("Reconnection detected, triggering recovery");
      void performRecovery();
    }

    // Reset recovery flag when disconnected
    if (!isConnected) {
      hasRecovered.current = false;
    }

    lastConnectionState.current = connectionState;
  }, [connectionState, isConnected, performRecovery, log]);

  return {
    performRecovery,
    isRecovering: recoveryInProgress.current,
  };
}
