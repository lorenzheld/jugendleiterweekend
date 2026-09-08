-- Migration 0006: Inventory actions table for idempotent loot/assign operations
CREATE TABLE IF NOT EXISTS inventory_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  owner_type owner_type NOT NULL,
  owner_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

