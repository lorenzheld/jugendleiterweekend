/**
 * Player Proximity State Schema
 * ─────────────────────────────
 * Tracks which spatial zone each player occupies relative to each WorldObject.
 * Used by the Epic 2 three-radius state machine to detect enter/exit events
 * and to enforce the exit-hysteresis anti-flicker logic.
 *
 * Zone semantics:
 *   OUTSIDE      → effectiveDist > discovery_radius_m
 *   DISCOVERED   → effectiveDist ≤ discovery_radius_m   (map marker visible)
 *   INTERACTING  → effectiveDist ≤ interaction_radius_m,
 *                  OR within exit_hysteresis_radius_m after previously INTERACTING
 *   AGGRO        → effectiveDist ≤ enemy_aggro_radius_m (ENEMY type only)
 *   BOSS_JOIN    → effectiveDist ≤ boss_join_radius_m   (BOSS type only, 30 m)
 */

import { pgTable, uuid, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { players } from "./player.js";
import { worldObjects } from "./world.js";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const proximityZoneEnum = pgEnum("proximity_zone", [
  "OUTSIDE",
  "DISCOVERED",
  "INTERACTING",
  "AGGRO",
  "BOSS_JOIN",
]);

// ── Table ─────────────────────────────────────────────────────────────────────

/**
 * One row per (player, world_object) pair whose zone ≠ OUTSIDE *or* that
 * was recently non-OUTSIDE (rows are kept for hysteresis tracking).
 *
 * Upserted on every location update via ON CONFLICT (player_id, world_object_id).
 */
export const playerProximityStates = pgTable("player_proximity_state", {
  id: uuid("id").primaryKey().defaultRandom(),

  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),

  worldObjectId: uuid("world_object_id")
    .notNull()
    .references(() => worldObjects.id, { onDelete: "cascade" }),

  /** Current proximity zone for this (player, world_object) pair. */
  zone: proximityZoneEnum("zone").notNull().default("OUTSIDE"),

  /** Timestamp of last zone change (used for staleness checks). */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
