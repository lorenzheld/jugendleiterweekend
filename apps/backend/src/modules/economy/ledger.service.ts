import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

/**
 * Append a ledger entry in an idempotent way.
 * Expects idempotencyKey (uuid string), teamId, optional playerId, currencyType, amount, source.
 */
export async function appendLedgerEntry(opts: {
  idempotencyKey: string;
  teamId: string;
  playerId?: string | null;
  currencyType: "FAME" | "DENARII";
  amount: number;
  source: "QUEST" | "COMBAT" | "TRADE" | "STORE" | "ADMIN";
  metadata?: Record<string, unknown>;
}) {
  const {
    idempotencyKey,
    teamId,
    playerId = null,
    currencyType,
    amount,
    source,
  } = opts;

  const res = await db.execute(sql`
    WITH ins AS (
      INSERT INTO ledger_entry
        (id, team_id, player_id, currency_type, amount, source, idempotency_key, created_at)
      VALUES (
        gen_random_uuid(),
        ${teamId}::uuid,
        ${playerId}::uuid,
        ${currencyType}::currency_type,
        ${amount},
        ${source}::ledger_source,
        ${idempotencyKey}::uuid,
        now()
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *
    )
    SELECT * FROM ins
    UNION ALL
    SELECT * FROM ledger_entry
     WHERE idempotency_key = ${idempotencyKey}::uuid
       AND NOT EXISTS (SELECT 1 FROM ins)
  `);

  return (res.rows as unknown[])[0] ?? null;
}

export async function getTeamBalance(
  teamId: string,
  currencyType: "FAME" | "DENARII",
): Promise<number> {
  const res = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS bal
    FROM ledger_entry
    WHERE team_id = ${teamId}::uuid
      AND currency_type = ${currencyType}::currency_type
  `);
  return Number((res.rows as { bal: string }[])[0]?.bal ?? 0);
}
