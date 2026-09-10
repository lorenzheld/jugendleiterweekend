-- Schema columns used by the current app that were previously only applied via db:push.
-- Idempotent so existing prototype/production databases can migrate safely.

ALTER TABLE "player"
  ADD COLUMN IF NOT EXISTS "last_location_update" timestamptz;
--> statement-breakpoint

ALTER TABLE "player"
  ADD COLUMN IF NOT EXISTS "player_name" varchar(64);
--> statement-breakpoint

ALTER TABLE "team"
  ADD COLUMN IF NOT EXISTS "hp" integer NOT NULL DEFAULT 400;
--> statement-breakpoint

ALTER TABLE "team"
  ADD COLUMN IF NOT EXISTS "is_active" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

ALTER TABLE "quest_run"
  ADD COLUMN IF NOT EXISTS "accepted_at" timestamptz;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TYPE "public"."combat_state" ADD VALUE IF NOT EXISTS 'INITIALIZING' BEFORE 'AWAITING_ACTIONS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;
