/**
 * Geo Service
 * ───────────
 * Handles player location updates and all PostGIS-based spatial logic for Epic 2.
 *
 * Public API:
 *   updatePlayerLocation()      – Persist coordinates; run spatial engine; emit WS events
 *   getNearbyWorldObjects()     – Return WorldObjects within discovery radius
 *   checkEffectiveDistance()    – One-off distance check (used by other modules)
 *
 * effectiveDistance formula (Epic 2 spec):
 *   effectiveDistance = max(0, ST_DistanceSphere(playerPoint, targetPoint) − accuracy)
 *
 * GPS benefit-of-doubt: if GPS says 30 m away with ±15 m accuracy, the
 * effective distance is 15 m → player is considered within a 15 m radius.
 */

import { sql, eq, and, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { players } from "../../db/schema/player.js";
import { worldObjects } from "../../db/schema/world.js";
import { playerProximityStates } from "../../db/schema/proximity.js";
import {
  evaluateZones,
  computeExitTransitions,
  type SpatialWorldObject,
  type ProximityZone,
} from "./geo.spatial.js";
import type { WsHub } from "../ws/ws.hub.js";
import type {
  DistanceCheck,
  WorldObjectNearby,
  RadiusEvent,
} from "@jlw/contracts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateLocationResult {
  playerId: string;
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: string;
  /** Number of zone transitions that occurred (for logging / debugging). */
  transitionCount: number;
}

// Row shape returned by the PostGIS nearby query
interface NearbyRow extends Record<string, unknown> {
  id: string;
  external_id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  cluster: string | null;
  discovery_radius_m: number;
  interaction_radius_m: number;
  exit_hysteresis_radius_m: number;
  aggro_radius_m: number;
  actual_distance_m: string; // PostGIS returns numeric as string
}

// ── Location update (main entry point) ───────────────────────────────────────

/**
 * Persist the player's GPS position, run the spatial engine against all
 * WorldObjects in the current day's PlayArea, and emit WS radius events
 * for any zone transitions.
 *
 * @param opts.wsHub  Optional WebSocket hub. When omitted (e.g. in tests),
 *                    transitions are computed but not emitted.
 *
 * @throws 404-shaped Error if no player record exists for this account (GM/ADMIN).
 */
export async function updatePlayerLocation(opts: {
  accountId: string;
  lat: number;
  lng: number;
  accuracy: number;
  wsHub?: WsHub;
}): Promise<UpdateLocationResult> {
  const { accountId, lat, lng, accuracy, wsHub } = opts;

  // ── 1. Resolve accountId → player (with team) ─────────────────────────────
  const [player] = await db
    .select({
      id: players.id,
      teamId: players.teamId,
      // Include account username for WS event playerName field
    })
    .from(players)
    .where(eq(players.accountId, accountId));

  if (!player) {
    const err = new Error(
      "No player record found for this account. GMs cannot update location.",
    ) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // ── 2. Persist lat/lng + PostGIS geometry ─────────────────────────────────
  await db.execute(sql`
    UPDATE player
    SET
      last_lat = ${lat},
      last_lng = ${lng},
      geom     = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    WHERE id = ${player.id}
  `);

  // ── 3. Query WorldObjects within discovery radius via PostGIS ─────────────
  const nearbyRows = await queryNearbyWorldObjects({ lat, lng, accuracy });

  // ── 4. Load current proximity states for this player ──────────────────────
  const stateRows = await db
    .select({
      worldObjectId: playerProximityStates.worldObjectId,
      zone: playerProximityStates.zone,
    })
    .from(playerProximityStates)
    .where(eq(playerProximityStates.playerId, player.id));

  const currentStates = new Map<string, ProximityZone>(
    stateRows.map((r) => [r.worldObjectId, r.zone as ProximityZone]),
  );

  // ── 5. Run state machine ───────────────────────────────────────────────────
  const nearbyAsSpatial = nearbyRows.map(
    (r): SpatialWorldObject & {
      actualDistanceM: number;
      effectiveDistanceM: number;
    } => ({
      id: r.id,
      externalId: r.external_id,
      type: r.type as SpatialWorldObject["type"],
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      cluster: r.cluster,
      discoveryRadiusM: r.discovery_radius_m,
      interactionRadiusM: r.interaction_radius_m,
      exitHysteresisRadiusM: r.exit_hysteresis_radius_m,
      aggroRadiusM: r.aggro_radius_m,
      actualDistanceM: parseFloat(r.actual_distance_m),
      effectiveDistanceM: Math.max(
        0,
        parseFloat(r.actual_distance_m) - accuracy,
      ),
    }),
  );

  const nearbyIds = new Set(nearbyRows.map((r) => r.id));
  const zoneResults = evaluateZones(nearbyAsSpatial, currentStates);
  const exitResults = computeExitTransitions(nearbyIds, currentStates);
  const allResults = [...zoneResults, ...exitResults];

  // ── 6. Persist state changes ───────────────────────────────────────────────
  const changed = allResults.filter((r) => r.changed);

  if (changed.length > 0) {
    // Upsert all changed states in one batch
    const upsertValues = changed.map((r) => ({
      playerId: player.id,
      worldObjectId: r.worldObjectId,
      zone: r.newZone,
    }));

    await db
      .insert(playerProximityStates)
      .values(upsertValues)
      .onConflictDoUpdate({
        target: [
          playerProximityStates.playerId,
          playerProximityStates.worldObjectId,
        ],
        set: {
          zone: sql`excluded.zone`,
          updatedAt: sql`now()`,
        },
      });
  }

  // ── 7. Emit WebSocket events for transitions ──────────────────────────────
  if (wsHub && changed.length > 0) {
    // Build a name lookup for changed objects
    const changedIds = changed
      .filter((r) => r.actualDistanceM !== Infinity)
      .map((r) => r.worldObjectId);

    let objectNames = new Map<string, { name: string; type: string }>();
    if (changedIds.length > 0) {
      const nameRows = await db
        .select({
          id: worldObjects.id,
          name: worldObjects.name,
          type: worldObjects.type,
        })
        .from(worldObjects)
        .where(inArray(worldObjects.id, changedIds));

      objectNames = new Map(nameRows.map((r) => [r.id, { name: r.name, type: r.type }]));
    }

    // Also look up names for exit transitions (not in nearby query)
    const exitIds = exitResults.map((r) => r.worldObjectId);
    if (exitIds.length > 0) {
      const exitNameRows = await db
        .select({ id: worldObjects.id, name: worldObjects.name, type: worldObjects.type })
        .from(worldObjects)
        .where(inArray(worldObjects.id, exitIds));
      for (const r of exitNameRows) {
        objectNames.set(r.id, { name: r.name, type: r.type });
      }
    }

    // Retrieve player username for the event
    const [accountRow] = await db.execute<{ username: string }>(
      sql`SELECT username FROM account WHERE id = ${accountId}`,
    ).then((r) => r.rows as { username: string }[]);

    const playerName = accountRow?.username ?? "Unknown";
    const now = new Date().toISOString();

    for (const transition of changed) {
      const obj = objectNames.get(transition.worldObjectId);
      if (!obj) continue;

      const event: RadiusEvent = {
        event: "radius.transition",
        playerId: player.id,
        playerName,
        teamId: player.teamId,
        worldObjectId: transition.worldObjectId,
        worldObjectName: obj.name,
        worldObjectType: obj.type as RadiusEvent["worldObjectType"],
        previousZone: transition.previousZone,
        newZone: transition.newZone,
        effectiveDistanceM:
          transition.effectiveDistanceM === Infinity
            ? -1
            : transition.effectiveDistanceM,
        timestamp: now,
      };

      // BOSS_JOIN events are broadcast to all clients (global boss mechanic)
      if (
        transition.newZone === "BOSS_JOIN" ||
        transition.previousZone === "BOSS_JOIN"
      ) {
        wsHub.broadcastAll(event);
      } else {
        wsHub.broadcastToTeam(player.teamId, event);
      }
    }
  }

  return {
    playerId: player.id,
    lat,
    lng,
    accuracy,
    updatedAt: new Date().toISOString(),
    transitionCount: changed.length,
  };
}

// ── Nearby WorldObjects query ─────────────────────────────────────────────────

/**
 * Return all WorldObjects whose `geom` is within the player's discovery radius
 * (default 55 m) using PostGIS `ST_DWithin` on the geography cast for
 * accurate metre-based distance on WGS-84.
 *
 * We query up to `discovery_radius_m` + `accuracy` so that objects at the
 * boundary aren't missed due to GPS imprecision.
 *
 * PostGIS note:
 *   ST_DWithin(geography, geography, metres) is faster than ST_DistanceSphere
 *   because it short-circuits once the bbox check passes.
 */
async function queryNearbyWorldObjects(opts: {
  lat: number;
  lng: number;
  accuracy: number;
}): Promise<NearbyRow[]> {
  const { lat, lng, accuracy } = opts;

  // Expand the search radius by the player's GPS accuracy to ensure we don't
  // miss objects at the boundary. Cap the expansion at 100 m to avoid pulling
  // in half of Rome on bad GPS days.
  const accuracyBuffer = Math.min(accuracy, 100);

  const result = await db.execute<NearbyRow>(sql`
    SELECT
      wo.id,
      wo.external_id,
      wo.type,
      wo.name,
      wo.lat,
      wo.lng,
      wo.cluster,
      wo.discovery_radius_m,
      wo.interaction_radius_m,
      wo.exit_hysteresis_radius_m,
      wo.aggro_radius_m,
      ST_DistanceSphere(
        wo.geom,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      ) AS actual_distance_m
    FROM world_object wo
    WHERE
      wo.geom IS NOT NULL
      AND wo.publishable = true
      AND ST_DWithin(
        wo.geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        wo.discovery_radius_m + ${accuracyBuffer}
      )
    ORDER BY actual_distance_m ASC
  `);

  return result.rows as NearbyRow[];
}

// ── Public: getNearbyWorldObjects ─────────────────────────────────────────────

/**
 * Return nearby WorldObjects enriched with the current player zone.
 * Used by GET /api/v1/geo/world-objects.
 *
 * @throws 404 if no player record exists for this account.
 */
export async function getNearbyWorldObjects(opts: {
  accountId: string;
  accuracy: number;
}): Promise<{
  objects: WorldObjectNearby[];
  playerLat: number;
  playerLng: number;
}> {
  const { accountId, accuracy } = opts;

  // Load player (need lat/lng + teamId)
  const [player] = await db
    .select({
      id: players.id,
      teamId: players.teamId,
      lastLat: players.lastLat,
      lastLng: players.lastLng,
    })
    .from(players)
    .where(eq(players.accountId, accountId));

  if (!player) {
    const err = new Error(
      "No player record found for this account.",
    ) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (player.lastLat == null || player.lastLng == null) {
    // Player hasn't sent a location yet – return empty list
    return { objects: [], playerLat: 0, playerLng: 0 };
  }

  const nearby = await queryNearbyWorldObjects({
    lat: player.lastLat,
    lng: player.lastLng,
    accuracy,
  });

  // Load current proximity states
  const stateRows = await db
    .select({
      worldObjectId: playerProximityStates.worldObjectId,
      zone: playerProximityStates.zone,
    })
    .from(playerProximityStates)
    .where(eq(playerProximityStates.playerId, player.id));

  const currentStates = new Map<string, ProximityZone>(
    stateRows.map((r) => [r.worldObjectId, r.zone as ProximityZone]),
  );

  const objects: WorldObjectNearby[] = nearby.map((r) => {
    const actualDist = parseFloat(r.actual_distance_m);
    const effectiveDist = Math.max(0, actualDist - accuracy);
    const zone = currentStates.get(r.id) ?? "OUTSIDE";

    return {
      id: r.id,
      externalId: r.external_id,
      type: r.type as WorldObjectNearby["type"],
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      cluster: r.cluster,
      discoveryRadiusM: r.discovery_radius_m,
      interactionRadiusM: r.interaction_radius_m,
      exitHysteresisRadiusM: r.exit_hysteresis_radius_m,
      aggroRadiusM: r.aggro_radius_m,
      zone,
      effectiveDistanceM: effectiveDist,
    };
  });

  return {
    objects,
    playerLat: player.lastLat,
    playerLng: player.lastLng,
  };
}

// ── PostGIS distance validation ───────────────────────────────────────────────

/**
 * Calculate the distance between two WGS-84 points using PostGIS
 * `ST_DistanceSphere`, then apply the accuracy-tolerance formula.
 *
 * PostGIS note: ST_MakePoint expects (longitude, latitude) order.
 *
 * @param playerLat  Player's latitude (degrees)
 * @param playerLng  Player's longitude (degrees)
 * @param targetLat  Target object's latitude (degrees)
 * @param targetLng  Target object's longitude (degrees)
 * @param accuracy   Player's GPS horizontal accuracy (metres)
 * @param targetRadius  Interaction/discovery radius of the target object (metres)
 */
export async function checkEffectiveDistance(opts: {
  playerLat: number;
  playerLng: number;
  targetLat: number;
  targetLng: number;
  accuracy: number;
  targetRadius: number;
}): Promise<DistanceCheck> {
  const { playerLat, playerLng, targetLat, targetLng, accuracy, targetRadius } =
    opts;

  const result = await db.execute<{ distance_m: string }>(sql`
    SELECT ST_DistanceSphere(
      ST_MakePoint(${playerLng}, ${playerLat}),
      ST_MakePoint(${targetLng}, ${targetLat})
    ) AS distance_m
  `);

  const rows = result.rows as { distance_m: string }[];
  const actualDistanceM = parseFloat(rows[0]?.distance_m ?? "Infinity");
  const effectiveDistanceM = Math.max(0, actualDistanceM - accuracy);
  const withinRange = effectiveDistanceM <= targetRadius;

  return { actualDistanceM, effectiveDistanceM, withinRange };
}
