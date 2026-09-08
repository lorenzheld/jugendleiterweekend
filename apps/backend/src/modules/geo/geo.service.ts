/**
 * Geo Service
 * -----------
 * Handles player location updates and PostGIS-based distance validation.
 *
 * effectiveDistance formula (Epic 2 spec):
 *   effectiveDistance = max(0, ST_DistanceSphere(playerPoint, targetPoint) - accuracy)
 *
 * This gives the player the benefit of the doubt: if GPS says they are 30 m
 * from a target with 15 m accuracy, the effective distance is 15 m.
 */

import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { players } from "../../db/schema/player.js";
import type { DistanceCheck } from "@jlw/contracts";

// ── Location update ───────────────────────────────────────────────────────────

export interface UpdateLocationResult {
  playerId: string;
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: string;
}

/**
 * Persist the player's current GPS position.
 * Finds the player row via `accountId` (derived from the JWT `sub` claim).
 *
 * @throws 404-shaped Error if no player record exists for this account (GM/ADMIN).
 */
export async function updatePlayerLocation(opts: {
  accountId: string;
  lat: number;
  lng: number;
  accuracy: number;
}): Promise<UpdateLocationResult> {
  // Resolve accountId → player
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.accountId, opts.accountId));

  if (!player) {
    const err = new Error(
      "No player record found for this account. GMs cannot update location.",
    ) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Update stored coordinates (raw lat/lng – PostGIS geometry migration in Epic 3)
  await db
    .update(players)
    .set({ lastLat: opts.lat, lastLng: opts.lng })
    .where(eq(players.id, player.id));

  return {
    playerId: player.id,
    lat: opts.lat,
    lng: opts.lng,
    accuracy: opts.accuracy,
    updatedAt: new Date().toISOString(),
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

  // Run the PostGIS distance query
  const result = await db.execute<{ distance_m: string }>(sql`
    SELECT ST_DistanceSphere(
      ST_MakePoint(${playerLng}, ${playerLat}),
      ST_MakePoint(${targetLng}, ${targetLat})
    ) AS distance_m
  `);

  const rows = result.rows as { distance_m: string }[];
  const actualDistanceM = parseFloat(rows[0]?.distance_m ?? "Infinity");

  // Apply accuracy tolerance – clamp to 0 to avoid negative distances
  const effectiveDistanceM = Math.max(0, actualDistanceM - accuracy);
  const withinRange = effectiveDistanceM <= targetRadius;

  return { actualDistanceM, effectiveDistanceM, withinRange };
}
