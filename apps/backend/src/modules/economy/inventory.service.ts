import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import crypto from "node:crypto";
import { appendLedgerEntry } from "./ledger.service.js";

type OwnerType = "PLAYER" | "TEAM";

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function parseStats(raw: unknown): Record<string, number> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number") out[k] = v;
    }
    return out;
  }
  if (typeof raw === "string") {
    try {
      return parseStats(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return {};
}

function slotFromDef(def: { equip_slot?: string | null; slot?: string | null }): string {
  return def.equip_slot ?? def.slot ?? "CONSUMABLE";
}

export async function getItemCount(ownerType: OwnerType, ownerId: string): Promise<number> {
  const res = await db.execute(sql`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM item_instance
    WHERE owner_type = ${ownerType}::owner_type AND owner_id = ${ownerId}::uuid
  `);
  return Number((res.rows as { total: string }[])[0]?.total ?? 0);
}

export async function assignLoot(opts: {
  idempotencyKey: string;
  ownerType: OwnerType;
  ownerId: string;
  items?: { defKey: string; quantity: number }[];
  currencies?: {
    currencyType: "DENARII" | "FAME";
    amount: number;
    playerId?: string | null;
  }[];
  personalLimit?: number;
  teamLimit?: number;
}) {
  const {
    idempotencyKey,
    ownerType,
    ownerId,
    items = [],
    currencies = [],
    personalLimit = 20,
    teamLimit = 40,
  } = opts;

  const existing = await db.execute(sql`
    SELECT * FROM inventory_action WHERE idempotency_key = ${idempotencyKey}::uuid
  `);
  if (existing.rows.length > 0) {
    return { alreadyProcessed: true, result: existing.rows[0] };
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM item_instance
      WHERE owner_type = ${ownerType}::owner_type AND owner_id = ${ownerId}::uuid
      FOR UPDATE
    `);

    const countRes = await tx.execute(sql`
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM item_instance
      WHERE owner_type = ${ownerType}::owner_type AND owner_id = ${ownerId}::uuid
    `);
    const currentTotal = Number((countRes.rows as { total: string }[])[0]?.total ?? 0);
    const incomingTotal = items.reduce((s, it) => s + Math.max(0, it.quantity | 0), 0);
    const limit = ownerType === "PLAYER" ? personalLimit : teamLimit;
    if (currentTotal + incomingTotal > limit) {
      throw httpError(
        `Inventory limit exceeded: ${currentTotal + incomingTotal} > ${limit}`,
        409,
      );
    }

    for (const it of items) {
      const defRes = await tx.execute(sql`SELECT * FROM item_def WHERE key = ${it.defKey}`);
      const def = (defRes.rows as {
        stackable: boolean;
        equip_slot: string | null;
      }[])[0];
      if (!def) throw httpError(`Item definition not found: ${it.defKey}`, 404);

      const slot = slotFromDef(def);

      if (def.stackable) {
        const upd = await tx.execute(sql`
          UPDATE item_instance
          SET quantity = quantity + ${it.quantity}
          WHERE owner_type = ${ownerType}::owner_type
            AND owner_id = ${ownerId}::uuid
            AND definition_id = ${it.defKey}
          RETURNING id
        `);
        if (upd.rows.length === 0) {
          await tx.execute(sql`
            INSERT INTO item_instance
              (id, definition_id, owner_type, owner_id, quantity, slot, is_equipped, is_bound)
            VALUES (
              gen_random_uuid(), ${it.defKey}, ${ownerType}::owner_type, ${ownerId}::uuid,
              ${it.quantity}, ${slot}::item_slot, false, false
            )
          `);
        }
      } else {
        for (let i = 0; i < it.quantity; i++) {
          await tx.execute(sql`
            INSERT INTO item_instance
              (id, definition_id, owner_type, owner_id, quantity, slot, is_equipped, is_bound)
            VALUES (
              gen_random_uuid(), ${it.defKey}, ${ownerType}::owner_type, ${ownerId}::uuid,
              1, ${slot}::item_slot, false, false
            )
          `);
        }
      }
    }

    let teamIdForPlayer: string | null = null;
    if (ownerType === "PLAYER") {
      const tp = await tx.execute(sql`
        SELECT team_id FROM player WHERE id = ${ownerId}::uuid
      `);
      teamIdForPlayer = (tp.rows as { team_id: string }[])[0]?.team_id ?? null;
      if (!teamIdForPlayer) {
        throw httpError("Player not found or has no team", 404);
      }
    }

    for (const cur of currencies) {
      await appendLedgerEntry({
        idempotencyKey: crypto.randomUUID(),
        teamId: ownerType === "TEAM" ? ownerId : (teamIdForPlayer as string),
        playerId: cur.playerId ?? (ownerType === "PLAYER" ? ownerId : null),
        currencyType: cur.currencyType,
        amount: cur.amount,
        source: "QUEST",
      });
    }

    await tx.execute(sql`
      INSERT INTO inventory_action (idempotency_key, owner_type, owner_id, payload)
      VALUES (
        ${idempotencyKey}::uuid,
        ${ownerType}::owner_type,
        ${ownerId}::uuid,
        ${JSON.stringify({ items, currencies })}::jsonb
      )
    `);

    return {
      alreadyProcessed: false,
      result: { itemsAssigned: items.length, currenciesAssigned: currencies.length },
    };
  });
}

export async function listInventory(ownerType: OwnerType, ownerId: string) {
  const res = await db.execute(sql`
    SELECT i.*, d.name, d.stats, d.stackable
    FROM item_instance i
    LEFT JOIN item_def d ON d.key = i.definition_id
    WHERE i.owner_type = ${ownerType}::owner_type AND i.owner_id = ${ownerId}::uuid
    ORDER BY d.name ASC
  `);
  return res.rows;
}

export async function equipItem(accountId: string, itemInstanceId: string) {
  const playerRow = await db.execute(sql`
    SELECT p.id AS player_id FROM player p WHERE p.account_id = ${accountId}::uuid
  `);
  const player = (playerRow.rows as { player_id: string }[])[0];
  if (!player) throw httpError("Player not found", 404);
  const playerId = player.player_id;

  const rowRes = await db.execute(sql`
    SELECT i.*, d.equip_slot
    FROM item_instance i
    LEFT JOIN item_def d ON d.key = i.definition_id
    WHERE i.id = ${itemInstanceId}::uuid
  `);
  const row = (rowRes.rows as {
    owner_type: string;
    owner_id: string;
    equip_slot: string | null;
  }[])[0];
  if (!row) throw httpError("Item not found", 404);
  if (row.owner_type !== "PLAYER" || row.owner_id !== playerId) {
    throw httpError("Item not owned by player", 403);
  }
  if (!row.equip_slot) throw httpError("Item not equippable", 400);

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE item_instance SET is_equipped = false
      WHERE owner_type = 'PLAYER'::owner_type
        AND owner_id = ${playerId}::uuid
        AND is_equipped = true
        AND definition_id IN (SELECT key FROM item_def WHERE equip_slot = ${row.equip_slot}::item_slot)
    `);
    await tx.execute(sql`
      UPDATE item_instance SET is_equipped = true WHERE id = ${itemInstanceId}::uuid
    `);
  });

  return { equipped: itemInstanceId, slot: row.equip_slot };
}

export async function unequipItem(accountId: string, itemInstanceId: string) {
  const playerRow = await db.execute(sql`
    SELECT p.id AS player_id FROM player p WHERE p.account_id = ${accountId}::uuid
  `);
  const player = (playerRow.rows as { player_id: string }[])[0];
  if (!player) throw httpError("Player not found", 404);

  const rowRes = await db.execute(sql`
    SELECT * FROM item_instance WHERE id = ${itemInstanceId}::uuid
  `);
  const row = (rowRes.rows as { owner_type: string; owner_id: string }[])[0];
  if (!row) throw httpError("Item not found", 404);
  if (row.owner_type !== "PLAYER" || row.owner_id !== player.player_id) {
    throw httpError("Item not owned by player", 403);
  }

  await db.execute(sql`
    UPDATE item_instance SET is_equipped = false WHERE id = ${itemInstanceId}::uuid
  `);
  return { unequipped: itemInstanceId };
}

export async function computeEquippedStats(ownerType: OwnerType, ownerId: string) {
  const res = await db.execute(sql`
    SELECT d.stats
    FROM item_instance i
    JOIN item_def d ON d.key = i.definition_id
    WHERE i.owner_type = ${ownerType}::owner_type
      AND i.owner_id = ${ownerId}::uuid
      AND i.is_equipped = true
  `);
  const totals: Record<string, number> = {};
  for (const r of res.rows as { stats: unknown }[]) {
    for (const [k, v] of Object.entries(parseStats(r.stats))) {
      totals[k] = (totals[k] ?? 0) + v;
    }
  }
  return totals;
}
