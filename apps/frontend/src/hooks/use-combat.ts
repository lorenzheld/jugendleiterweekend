/**
 * Combat Hook (Epic 6)
 * Manages combat state, WebSocket events, and API calls.
 */

import { useState, useEffect, useCallback } from "react";
import { randomUUID } from "crypto";
import type {
  CombatInstance,
  CombatLog,
  ActionType,
  CombatStartedEvent,
  CombatRoundResolvedEvent,
  CombatCompletedEvent,
  CombatActionSubmittedEvent,
} from "@jlw/contracts";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useCombat(playerId: string, token?: string) {
  const [activeCombat, setActiveCombat] = useState<CombatInstance | null>(null);
  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active combat for player's team
  const fetchActiveCombat = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/combat/team/active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const combat: CombatInstance = await res.json();
        setActiveCombat(combat);
      } else if (res.status === 404) {
        setActiveCombat(null);
      } else {
        throw new Error("Failed to fetch active combat");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Submit combat action
  const submitAction = useCallback(
    async (actionType: ActionType, targetId?: string) => {
      if (!activeCombat || !token) return;

      const idempotencyKey = randomUUID();

      try {
        const res = await fetch(
          `${API_BASE}/api/v1/combat/${activeCombat.id}/action`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              actionType,
              targetId,
              idempotencyKey,
            }),
          }
        );

        if (!res.ok) {
          throw new Error("Failed to submit action");
        }

        // Refresh combat state
        await fetchActiveCombat();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [activeCombat, token, fetchActiveCombat]
  );

  // Listen to WebSocket events
  useEffect(() => {
    if (!token) return;

    // TODO: Implement WebSocket connection and event listeners
    // For now, poll active combat every 5 seconds
    const interval = setInterval(() => {
      void fetchActiveCombat();
    }, 5000);

    return () => clearInterval(interval);
  }, [token, fetchActiveCombat]);

  // Handle WebSocket events
  const handleCombatStarted = useCallback((event: CombatStartedEvent) => {
    void fetchActiveCombat();
  }, [fetchActiveCombat]);

  const handleRoundResolved = useCallback((event: CombatRoundResolvedEvent) => {
    setLogs((prev) => [...prev, ...event.data.logs]);
    void fetchActiveCombat();
  }, [fetchActiveCombat]);

  const handleCombatCompleted = useCallback((event: CombatCompletedEvent) => {
    setLogs((prev) => [...prev, ...event.data.logs]);
    void fetchActiveCombat();

    // Clear combat after 3 seconds
    setTimeout(() => {
      setActiveCombat(null);
      setLogs([]);
    }, 3000);
  }, [fetchActiveCombat]);

  return {
    activeCombat,
    logs,
    isLoading,
    error,
    submitAction,
    fetchActiveCombat,
    handleCombatStarted,
    handleRoundResolved,
    handleCombatCompleted,
  };
}
