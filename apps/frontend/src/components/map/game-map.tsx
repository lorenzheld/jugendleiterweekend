/**
 * GameMap
 * -------
 * Renders the basemap (MapTiler / OSM) via react-map-gl (MapLibre GL JS)
 * and shows the current player position as a pulsing marker.
 *
 * The map style URL is configured via VITE_MAPTILER_KEY.
 * If the key is missing a MapLibre demo style is used as fallback.
 *
 * GPS position is continuously tracked via the `useGeolocation` hook which
 * also rate-limits server updates (every 30 s).
 */

import { useCallback, useRef, useState } from "react";
import Map, { type MapRef, Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { useGeolocation } from "../../hooks/use-geolocation.js";
import { useAuth } from "../../contexts/auth.context.js";

// ── Map style ─────────────────────────────────────────────────────────────────

const MAPTILER_KEY = import.meta.env["VITE_MAPTILER_KEY"] as string | undefined;

/** MapTiler Streets (OSM data) or the public MapLibre demo style as fallback. */
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";

// Default centre: Einsiedeln region (adjust to actual event location)
const DEFAULT_CENTER = { longitude: 8.749, latitude: 47.126 };
const DEFAULT_ZOOM = 15;

// ── Props ─────────────────────────────────────────────────────────────────────

interface GameMapProps {
  /** Called when the user presses the back-to-lobby button. */
  onBack?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameMap({ onBack }: GameMapProps) {
  const { profile } = useAuth();
  const { position, error: geoError, isReady } = useGeolocation();

  const mapRef = useRef<MapRef | null>(null);
  const [hasFollowedInitial, setHasFollowedInitial] = useState(false);

  /** Centre the map on the player's position once the first fix is acquired. */
  const handleMapLoad = useCallback(() => {
    if (position && !hasFollowedInitial) {
      mapRef.current?.flyTo({
        center: [position.lng, position.lat],
        zoom: DEFAULT_ZOOM,
        duration: 1200,
      });
      setHasFollowedInitial(true);
    }
  }, [position, hasFollowedInitial]);

  // Follow the player whenever a new position arrives (only if not yet followed)
  if (position && !hasFollowedInitial && mapRef.current) {
    mapRef.current.flyTo({
      center: [position.lng, position.lat],
      zoom: DEFAULT_ZOOM,
      duration: 800,
    });
    setHasFollowedInitial(true);
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1a1a2e]">
      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <Map
        ref={mapRef}
        initialViewState={{
          ...DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onLoad={handleMapLoad}
        // Disable satellite rotation on mobile to keep north-up for orientation
        bearing={0}
        attributionControl={false}
      >
        {/* Navigation controls (zoom +/-) */}
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Player marker */}
        {position && (
          <Marker longitude={position.lng} latitude={position.lat} anchor="center">
            {/* Pulsing dot */}
            <div className="relative flex items-center justify-center">
              {/* Outer pulse ring */}
              <span className="absolute h-10 w-10 animate-ping rounded-full bg-[#cd7f32]/30" />
              {/* Accuracy circle (visual hint – not to scale) */}
              <span className="absolute h-6 w-6 rounded-full bg-[#cd7f32]/20 ring-2 ring-[#cd7f32]/40" />
              {/* Centre dot */}
              <span className="relative h-3 w-3 rounded-full bg-[#cd7f32] ring-2 ring-white shadow-lg" />
            </div>
          </Marker>
        )}
      </Map>

      {/* ── HUD Overlays ────────────────────────────────────────────────── */}

      {/* Top bar */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10
                      flex items-center justify-between px-4 py-3
                      bg-gradient-to-b from-black/70 to-transparent"
      >
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="pointer-events-auto rounded-full bg-black/50 px-4 py-1.5
                       text-xs font-semibold text-[#f4e4c1] backdrop-blur-sm
                       hover:bg-black/70 active:scale-95 transition"
          >
            ← Lobby
          </button>
        )}

        {/* Player name & team */}
        {profile?.player?.team && (
          <div className="ml-auto text-right">
            <p className="text-xs font-bold text-[#cd7f32] tracking-widest">
              {profile.player.team.name}
            </p>
            <p className="text-[10px] text-[#f4e4c1]/70">
              {profile.account.username}
            </p>
          </div>
        )}
      </div>

      {/* GPS status badge */}
      <div className="absolute bottom-20 left-3 z-10">
        {!isReady && !geoError && (
          <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-[#cd7f32] backdrop-blur-sm animate-pulse">
            📡 GPS wird gesucht…
          </div>
        )}
        {geoError && (
          <div className="max-w-[200px] rounded-lg bg-red-900/80 px-3 py-2 text-xs text-red-200 backdrop-blur-sm">
            ⚠️ {geoError}
          </div>
        )}
        {isReady && position && (
          <div className="rounded-full bg-black/50 px-3 py-1 text-[10px] text-green-400 backdrop-blur-sm">
            📡 ±{Math.round(position.accuracy)} m
          </div>
        )}
      </div>
    </div>
  );
}
