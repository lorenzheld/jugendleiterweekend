/**
 * useGeolocation
 * --------------
 * Wraps the browser's Geolocation API (`navigator.geolocation.watchPosition`).
 *
 * - Automatically starts watching on mount and cleans up on unmount.
 * - Periodically sends position updates to the backend (every SEND_INTERVAL_MS).
 * - Exposes the latest position and any error string.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import type { UpdateLocationRequest } from "@jlw/contracts";

// How often (ms) we push location to the server even if position didn't change.
const SEND_INTERVAL_MS = 30_000; // 30 seconds

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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeolocation(enabled = true): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the latest position so the interval callback doesn't
  // capture a stale closure.
  const latestPosition = useRef<GeoPosition | null>(null);
  const lastSentAt = useRef<number>(0);

  /** Push position to the backend if enough time has elapsed. */
  const maybeSendToBackend = useCallback(async (pos: GeoPosition) => {
    const now = Date.now();
    if (now - lastSentAt.current < SEND_INTERVAL_MS) return;
    lastSentAt.current = now;

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

      // Fire-and-forget location sync (rate-limited internally)
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
