-- Epic 3: PlayArea PostGIS geometry & name column
-- --------------------------------------------------
-- Adds a human-readable name and a PostGIS Polygon geometry to the
-- play_area table introduced in the initial schema.
-- Backfills geom from the existing geometry_geo_json text column.
-- --------------------------------------------------

-- ── 1. name column ───────────────────────────────────────────────────────────
ALTER TABLE "play_area"
  ADD COLUMN IF NOT EXISTS "name" varchar(128);
--> statement-breakpoint

-- ── 2. PostGIS Polygon geometry ──────────────────────────────────────────────
ALTER TABLE "play_area"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Polygon, 4326);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_play_area_geom"
  ON "play_area" USING GIST("geom");
--> statement-breakpoint

-- ── 3. Backfill geom from stored GeoJSON text ─────────────────────────────────
-- Only runs for rows where geometry_geo_json is a valid Polygon / MultiPolygon.
UPDATE "play_area"
SET "geom" = ST_GeomFromGeoJSON("geometry_geo_json")
WHERE "geometry_geo_json" IS NOT NULL
  AND "geom" IS NULL
  AND jsonb_typeof(("geometry_geo_json")::jsonb) = 'object';
