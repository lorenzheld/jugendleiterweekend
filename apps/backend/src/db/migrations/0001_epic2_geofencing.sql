-- Epic 2: Geofencing & Spatial Engine
-- ------------------------------------
-- Adds PostGIS geometry columns to world_object and player,
-- creates spatial GiST indexes for fast ST_DWithin queries,
-- and introduces the player_proximity_state table for the
-- three-radius enter/exit state machine.
-- ------------------------------------

-- PostGIS must be enabled (docker image postgis/postgis:16-3.4-alpine handles this).
-- This migration is idempotent via IF NOT EXISTS guards.

-- ── 1. PostGIS geometry on world_object ──────────────────────────────────────
ALTER TABLE "world_object"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326);
--> statement-breakpoint

-- Backfill existing rows from lat/lng
UPDATE "world_object"
  SET "geom" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)
WHERE "lng" IS NOT NULL AND "lat" IS NOT NULL AND "geom" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_world_object_geom"
  ON "world_object" USING GIST("geom");
--> statement-breakpoint

-- ── 2. PostGIS geometry on player ────────────────────────────────────────────
ALTER TABLE "player"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326);
--> statement-breakpoint

-- Backfill existing rows
UPDATE "player"
  SET "geom" = ST_SetSRID(ST_MakePoint("last_lng", "last_lat"), 4326)
WHERE "last_lng" IS NOT NULL AND "last_lat" IS NOT NULL AND "geom" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_player_geom"
  ON "player" USING GIST("geom");
--> statement-breakpoint

-- ── 3. Proximity zone enum ───────────────────────────────────────────────────
-- OUTSIDE      → player is farther than discovery_radius
-- DISCOVERED   → within discovery_radius but outside interaction_radius
-- INTERACTING  → within interaction_radius (or hysteresis zone after entering)
-- AGGRO        → within enemy_aggro_radius (ENEMY type only)
-- BOSS_JOIN    → within boss_join_radius (BOSS type only)
DO $$ BEGIN
  CREATE TYPE "public"."proximity_zone"
    AS ENUM('OUTSIDE', 'DISCOVERED', 'INTERACTING', 'AGGRO', 'BOSS_JOIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ── 4. player_proximity_state ────────────────────────────────────────────────
-- One row per (player, world_object) pair that is not OUTSIDE.
-- Rows are upserted on every location update; rows with zone = OUTSIDE
-- are kept for hysteresis tracking but cleaned up by a nightly job (Epic 9).
CREATE TABLE IF NOT EXISTS "player_proximity_state" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id"       uuid NOT NULL
    REFERENCES "player"("id") ON DELETE CASCADE,
  "world_object_id" uuid NOT NULL
    REFERENCES "world_object"("id") ON DELETE CASCADE,
  "zone"            "proximity_zone" DEFAULT 'OUTSIDE' NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_proximity_player_wo"
    UNIQUE("player_id", "world_object_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_proximity_player_id"
  ON "player_proximity_state"("player_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_proximity_world_object_id"
  ON "player_proximity_state"("world_object_id");
