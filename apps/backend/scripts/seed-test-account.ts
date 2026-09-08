/**
 * seed-test-account.ts
 * --------------------
 * Legt einen Test-Account + Test-Team + Test-Spieler in der Datenbank an.
 * Nur für lokale Entwicklung – niemals in Produktion verwenden!
 *
 * Ausführen:
 *   cd apps/backend
 *   pnpm tsx scripts/seed-test-account.ts
 */

import { db } from "../src/db/client.js";
import { accounts, sessions } from "../src/db/schema/account.js";
import { teams, players } from "../src/db/schema/player.js";
import { hashAccessCode } from "../src/modules/auth/auth.service.js";
import { eq } from "drizzle-orm";

const TEST_ACCESS_CODE = "test1234";
const TEST_USERNAME = "testuser";
const TEST_TEAM_NAME = "Die Testgilde";

async function seed() {
  console.log("🌱 Starte Seeding...\n");

  // ── 1. Alten Test-Account aufräumen ──────────────────────────────────────
  const existing = await db
    .select()
    .from(accounts)
    .where(eq(accounts.username, TEST_USERNAME));

  if (existing.length > 0 && existing[0]) {
    console.log("♻️  Alter Test-Account gefunden – wird gelöscht...");
    await db.delete(sessions).where(eq(sessions.accountId, existing[0].id));
    await db.delete(players).where(eq(players.accountId, existing[0].id));
    await db.delete(accounts).where(eq(accounts.id, existing[0].id));
  }

  // ── 2. Access-Code hashen ────────────────────────────────────────────────
  console.log(`🔑 Hashe Zugangscode "${TEST_ACCESS_CODE}"...`);
  const accessCodeHash = await hashAccessCode(TEST_ACCESS_CODE);

  // ── 3. Account anlegen ───────────────────────────────────────────────────
  const [account] = await db
    .insert(accounts)
    .values({
      username: TEST_USERNAME,
      accessCodeHash,
      role: "PLAYER",
    })
    .returning();

  console.log(`✅ Account angelegt: ID = ${account!.id}`);

  // ── 4. Team anlegen (oder vorhandenes nutzen) ─────────────────────────────
  let team = (
    await db.select().from(teams).where(eq(teams.name, TEST_TEAM_NAME))
  )[0];

  if (!team) {
    [team] = await db
      .insert(teams)
      .values({ name: TEST_TEAM_NAME, inventoryCapacity: 40 })
      .returning();
    console.log(`✅ Team angelegt:   ID = ${team!.id}`);
  } else {
    console.log(`♻️  Team bereits vorhanden: ID = ${team.id}`);
  }

  // ── 5. Spieler anlegen ───────────────────────────────────────────────────
  const [player] = await db
    .insert(players)
    .values({
      accountId: account!.id,
      teamId: team!.id,
      class: "GARDIST",
      hpCurrent: 100,
      status: "ACTIVE",
    })
    .returning();

  console.log(`✅ Spieler angelegt: ID = ${player!.id}\n`);

  // ── Zusammenfassung ──────────────────────────────────────────────────────
  console.log("━".repeat(50));
  console.log("🎮 Test-Zugangsdaten:");
  console.log(`   Zugangscode : ${TEST_ACCESS_CODE}`);
  console.log(`   Username    : ${TEST_USERNAME}`);
  console.log(`   Team        : ${TEST_TEAM_NAME}`);
  console.log(`   Klasse      : GARDIST`);
  console.log("━".repeat(50));
  console.log("\n📋 Jetzt testen:");
  console.log(
    `   POST http://localhost:3000/api/v1/auth/login`,
  );
  console.log(`   Body: { "accessCode": "${TEST_ACCESS_CODE}" }\n`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed fehlgeschlagen:", err);
  process.exit(1);
});
