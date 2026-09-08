-- Migration 0005: Trade table for idempotent team-to-team trades
CREATE TABLE IF NOT EXISTS team_trade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  sender_team_id uuid NOT NULL,
  receiver_team_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

