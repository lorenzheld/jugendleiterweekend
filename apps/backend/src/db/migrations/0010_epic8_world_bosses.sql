-- Epic 8: World Bosses – Boss Join Radius
-- ─────────────────────────────────────────────────────────────────────────────
-- Add boss_join_radius_m column to world_object table for boss encounter join radius.

ALTER TABLE world_object
  ADD COLUMN IF NOT EXISTS boss_join_radius_m integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN world_object.boss_join_radius_m IS 'Boss-only: join radius for teams to participate in world boss. Default 30 m.';
