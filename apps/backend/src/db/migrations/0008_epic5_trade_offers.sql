-- Two-sided trade offers (offer / counter / accept / reject)
CREATE TABLE IF NOT EXISTS trade_offer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'OPEN',
  initiator_team_id uuid NOT NULL,
  counterparty_team_id uuid NOT NULL,
  initiator_payload jsonb NOT NULL,
  counterparty_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_offer_status_check
    CHECK (status IN ('OPEN', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT trade_offer_teams_distinct
    CHECK (initiator_team_id <> counterparty_team_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_offer_open_teams
  ON trade_offer (status, initiator_team_id, counterparty_team_id);
