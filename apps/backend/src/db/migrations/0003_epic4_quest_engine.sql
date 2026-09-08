-- Epic 4: Quest Engine – Schema patches
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add completed_at timestamp to quest_run.
-- 2. Add UNIQUE(quest_run_id, objective_id) to objective_progress
--    so that ON CONFLICT upserts in the quest state machine work correctly.
-- 3. Add performance indices for common query patterns.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. quest_run.completed_at ─────────────────────────────────────────────────
ALTER TABLE "quest_run"
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
--> statement-breakpoint

-- ── 2. objective_progress unique constraint ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_objective_progress_run_obj'
  ) THEN
    ALTER TABLE "objective_progress"
      ADD CONSTRAINT "uq_objective_progress_run_obj"
      UNIQUE ("quest_run_id", "objective_id");
  END IF;
END;
$$;
--> statement-breakpoint

-- ── 3. Indices ────────────────────────────────────────────────────────────────

-- Active quests per team (most common read path: GET /api/v1/quests)
CREATE INDEX IF NOT EXISTS "idx_quest_run_team_state"
  ON "quest_run" ("team_id", "state");
--> statement-breakpoint

-- Objective progress lookup by run (used on every step advance)
CREATE INDEX IF NOT EXISTS "idx_objective_progress_run"
  ON "objective_progress" ("quest_run_id");
--> statement-breakpoint

-- Quest steps by definition + flow_phase (discover/accept/objective queries)
CREATE INDEX IF NOT EXISTS "idx_quest_step_def_phase"
  ON "quest_step" ("quest_definition_id", "flow_phase");
--> statement-breakpoint

-- Quest stations by world_object (proximity-based discovery)
CREATE INDEX IF NOT EXISTS "idx_quest_station_world_object"
  ON "quest_station" ("world_object_id");
--> statement-breakpoint

-- Quest stations by quest_definition (accept flow)
CREATE INDEX IF NOT EXISTS "idx_quest_station_quest_def"
  ON "quest_station" ("quest_definition_id");
