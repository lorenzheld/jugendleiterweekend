-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Epic 9: GM Dashboard & Operations                                        ║
-- ║ Adds event_state table and extends audit capabilities                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Event Lifecycle State ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE event_lifecycle_state AS ENUM (
    'NOT_STARTED',
    'ACTIVE',
    'PAUSED',
    'ENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS event_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state event_lifecycle_state NOT NULL DEFAULT 'NOT_STARTED',
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  leaderboard_frozen BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial state
INSERT INTO event_state (state) VALUES ('NOT_STARTED');

-- ── GM Command Action Types ───────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gm_command_type') THEN
    CREATE TYPE gm_command_type AS ENUM (
      'QUEST_RESET',
      'HP_OVERRIDE',
      'LOCATION_OVERRIDE',
      'CURRENCY_CORRECTION',
      'ITEM_GRANT',
      'EVENT_CONTROL'
    );
  END IF;
END $$;

-- ── Audit Event Extensions ────────────────────────────────────────────────────

-- Add indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_event_actor ON audit_event(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_action ON audit_event(action);
CREATE INDEX IF NOT EXISTS idx_audit_event_created ON audit_event(created_at DESC);

-- ── Media Review Status Index ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_media_status ON media_submission(status);
CREATE INDEX IF NOT EXISTS idx_media_team ON media_submission(team_id);

-- ── Quest Run State Index ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_quest_run_state ON quest_run(state);
CREATE INDEX IF NOT EXISTS idx_quest_run_team ON quest_run(team_id);

COMMENT ON TABLE event_state IS 'Epic 9: Global event lifecycle state (START/PAUSE/END)';
COMMENT ON TABLE audit_event IS 'Epic 9: GM command audit log – all GM actions are logged here';
