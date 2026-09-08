-- Migration 0004: Epic 5 – Inventory & Economy
-- Adds item_def, extends item_instance with owner_type + quantity

-- item_def master table
CREATE TABLE IF NOT EXISTS item_def (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  key varchar(64) NOT NULL UNIQUE,
  name varchar(128) NOT NULL,
  equip_slot item_slot,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  stackable boolean NOT NULL DEFAULT false,
  max_stack integer NOT NULL DEFAULT 1,
  buy_price integer,
  sell_price integer
);

-- add owner_type enum if not exists (owner_type created by drizzle migrations when generating schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_type') THEN
    CREATE TYPE owner_type AS ENUM ('PLAYER','TEAM');
  END IF;
END$$;

-- alter item_instance: add owner_type and quantity if missing
ALTER TABLE IF EXISTS item_instance
  ADD COLUMN IF NOT EXISTS owner_type owner_type NOT NULL DEFAULT 'PLAYER';

ALTER TABLE IF EXISTS item_instance
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

-- index for owner lookups
CREATE INDEX IF NOT EXISTS idx_item_instance_owner ON item_instance (owner_type, owner_id);

