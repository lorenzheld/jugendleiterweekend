-- Migration: Epic 7 – WebSocket Event Log
-- Create table for persisting WebSocket events for client recovery

CREATE TABLE IF NOT EXISTS "ws_event_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "team_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for recovery queries: WHERE team_id = ? AND timestamp > ?
CREATE INDEX IF NOT EXISTS "ws_event_log_team_timestamp_idx" 
  ON "ws_event_log" ("team_id", "timestamp");

-- Add comment for documentation
COMMENT ON TABLE "ws_event_log" IS 'WebSocket event log for client reconnection recovery. Events older than 5 minutes are automatically pruned.';
