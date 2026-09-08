/**
 * useGeolocation
 * --------------
 * Wraps the browser's Geolocation API (`navigator.geolocation.watchPosition`).
 *
 * - Automatically starts watching on mount and cleans up on unmount.
 * - Sends position to the backend immediately when:
 *     a) it is the first fix ever, OR
 *     b) the player moved more than SIGNIFICANT_MOVE_M metres since the last send.
 * - Always sends at least every SEND_INTERVAL_MS (keep-alive heartbeat).
 * - Exposes the latest position and any error string.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import type { UpdateLocationRequest } from "@jlw/contracts";

// Keep-alive heartbeat – send even if the player barely moved.
const SEND_INTERVAL_MS = 5_000; // 5 seconds

// Minimum distance (metres) that triggers an immediate send even within the
// heartbeat window.  Lowered to 5 m so DevTools location changes are picked
// up quickly.
const SIGNIFICANT_MOVE_M = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeoPosition {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres. */
  accuracy: number;
  /** Unix timestamp (ms) of the GPS reading. */
  timestamp: number;
}

export interface UseGeolocationResult {
  position: GeoPosition | null;
  error: string | null;
  /** Whether the first GPS fix has been acquired. */
  isReady: boolean;
}

// ── Haversine distance (metres) ───────────────────────────────────────────────

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeolocation(enabled = true): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the latest position so the interval callback doesn't
  // capture a stale closure.
  const latestPosition = useRef<GeoPosition | null>(null);
  const lastSentAt = useRef<number>(0);
  const lastSentPos = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Push position to the backend.
   * Sends immediately if:
   *   - never sent before, OR
   *   - player moved ≥ SIGNIFICANT_MOVE_M metres, OR
   *   - heartbeat interval elapsed.
   */
  const maybeSendToBackend = useCallback(async (pos: GeoPosition) => {
    const now = Date.now();
    const elapsed = now - lastSentAt.current;
    const prev = lastSentPos.current;

    const movedSignificantly =
      prev == null ||
      haversineM(prev.lat, prev.lng, pos.lat, pos.lng) >= SIGNIFICANT_MOVE_M;

    if (elapsed < SEND_INTERVAL_MS && !movedSignificantly) return;

    lastSentAt.current = now;
    lastSentPos.current = { lat: pos.lat, lng: pos.lng };

    const payload: UpdateLocationRequest = {
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
    };

    try {
      await api.post<unknown>("/geo/location", payload);
    } catch (err) {
      // Non-critical – the map still works locally even if the server is
      // temporarily unreachable. Log quietly.
      console.warn("[useGeolocation] Failed to send location to server:", err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    if (!navigator.geolocation) {
      setError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
    };

    const onSuccess = (geoPos: GeolocationPosition) => {
      const pos: GeoPosition = {
        lat: geoPos.coords.latitude,
        lng: geoPos.coords.longitude,
        accuracy: geoPos.coords.accuracy,
        timestamp: geoPos.timestamp,
      };
      latestPosition.current = pos;
      setPosition(pos);
      setError(null);

      // Fire-and-forget location sync
      void maybeSendToBackend(pos);
    };

    const onError = (geoErr: GeolocationPositionError) => {
      switch (geoErr.code) {
        case GeolocationPositionError.PERMISSION_DENIED:
          setError(
            "Standortzugriff verweigert. Bitte Browsereinstellungen prüfen.",
          );
          break;
        case GeolocationPositionError.POSITION_UNAVAILABLE:
          setError("Standort nicht verfügbar. GPS-Signal schwach?");
          break;
        case GeolocationPositionError.TIMEOUT:
          setError("GPS-Timeout. Wird erneut versucht…");
          break;
        default:
          setError("Unbekannter GPS-Fehler.");
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      options,
    );

    // Cleanup: stop watching when the component unmounts or `enabled` changes.
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, maybeSendToBackend]);

  return {
    position,
    error,
    isReady: position !== null,
  };
}
