/**
 * Combat Service (Epic 6)
 * PvE & PvP turn-based combat system with state machine.
 */
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  combatInstances,
  combatants,
  combatActions,
  pvpChallenges,
} from "../../db/schema/combat.js";
import { players, teams } from "../../db/schema/player.js";
import { worldObjects } from "../../db/schema/world.js";
import { ledgerEntries } from "../../db/schema/economy.js";
import type { WsHub } from "../ws/ws.hub.js";
import { randomUUID } from "node:crypto";

// ── Constants ────────────────────────────────────────────────────────────────

const ROUND_TIMER_MS = 15_000; // 15 seconds per round
const PVP_WARNING_TIMER_MS = 20_000; // 20 seconds warning before PvP
const PVP_AGGRO_RADIUS_M = 20;
const PVP_VISIBILITY_RADIUS_M = 60;
const HP_REGEN_OUT_OF_COMBAT = 5; // HP per second when not in combat
const RESPAWN_HP_PERCENTAGE = 0.5; // 50% HP after respawn

// ── Types ────────────────────────────────────────────────────────────────────

export interface CombatInstance {
  id: string;
  type: "PVE" | "PVP" | "BOSS";
  state: "INITIALIZING" | "AWAITING_ACTIONS" | "LOCKED" | "RESOLVING" | "COMPLETED";
  roundNumber: number;
  startedAt: Date;
  combatants: Combatant[];
  actions: CombatAction[];
}

export interface Combatant {
  id: string;
  entityType: "PLAYER" | "ENEMY";
  entityId: string;
  teamId?: string;
  hpCurrent: number;
  hpMax: number;
  initiative: number;
  name: string;
  isDowned: boolean;
}

export interface CombatAction {
  id: string;
  roundNumber: number;
  actorId: string;
  actionType: ActionType;
  targetId?: string;
  isLocked: boolean;
  damage?: number;
  effect?: string;
}

export type ActionType = "ATTACK" | "DEFEND" | "SKILL" | "FLEE";

export interface CombatLog {
  timestamp: Date;
  message: string;
  type: "ACTION" | "DAMAGE" | "EFFECT" | "STATE";
}

// ── PvE Encounter Management ─────────────────────────────────────────────────

/**
 * Starts a PvE combat instance when a team enters enemy_aggro_radius_m
 * with an active DEFEAT_ENEMY quest step.
 */
export async function startPvECombat(opts: {
  teamId: string;
  enemyWorldObjectId: string;
  wsHub?: WsHub;
}): Promise<CombatInstance> {
  const { teamId, enemyWorldObjectId, wsHub } = opts;

  // Check if combat already exists for this team
  const existingCombat = await getActiveCombatForTeam(teamId);
  if (existingCombat) {
    throw new Error("Team is already in combat");
  }

  // Get enemy data
  const [enemy] = await db
    .select()
    .from(worldObjects)
    .where(eq(worldObjects.id, enemyWorldObjectId));

  if (!enemy || enemy.type !== "ENEMY") {
    throw new Error("Invalid enemy encounter");
  }

  // Get team players
  const teamPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));

  if (teamPlayers.length === 0) {
    throw new Error("Team has no players");
  }

  // Create combat instance
  const [combat] = await db
    .insert(combatInstances)
    .values({
      type: "PVE",
      state: "INITIALIZING",
      roundNumber: 0,
    })
    .returning();

  // Create combatants for players
  const playerCombatants = await Promise.all(
    teamPlayers.map(async (player) => {
      const [combatant] = await db
        .insert(combatants)
        .values({
          combatInstanceId: combat.id,
          entityType: "PLAYER",
          entityId: player.id,
          teamId: player.teamId,
          hpCurrent: player.hpCurrent,
        })
        .returning();
      return combatant;
    })
  );

  // Create enemy combatant
  // Parse enemy stats from rawPropertiesJson
  const enemyProps = enemy.rawPropertiesJson
    ? JSON.parse(enemy.rawPropertiesJson)
    : {};
  const enemyHp = enemyProps.hp ?? 100;
  const enemyInitiative = enemyProps.initiative ?? 50;

  const [enemyCombatant] = await db
    .insert(combatants)
    .values({
      combatInstanceId: combat.id,
      entityType: "ENEMY",
      entityId: enemy.id,
      hpCurrent: enemyHp,
    })
    .returning();

  // Start round 1
  await db
    .update(combatInstances)
    .set({
      state: "AWAITING_ACTIONS",
      roundNumber: 1,
    })
    .where(eq(combatInstances.id, combat.id));

  // Schedule auto-lock after ROUND_TIMER_MS
  scheduleRoundLock(combat.id, ROUND_TIMER_MS, wsHub);

  // Emit WS event
  if (wsHub) {
    wsHub.sendToTeam(teamId, {
      event: "combat:started",
      data: { combatId: combat.id, type: "PVE", enemyName: enemy.name },
    });
  }

  return getCombatInstance(combat.id);
}

/**
 * Get full combat instance with combatants and actions.
 */
export async function getCombatInstance(combatId: string): Promise<CombatInstance> {
  const [combat] = await db
    .select()
    .from(combatInstances)
    .where(eq(combatInstances.id, combatId));

  if (!combat) {
    throw new Error("Combat not found");
  }

  const combatantsData = await db
    .select()
    .from(combatants)
    .where(eq(combatants.combatInstanceId, combatId));

  const actionsData = await db
    .select()
    .from(combatActions)
    .where(eq(combatActions.combatInstanceId, combatId));

  // Enrich combatants with names
  const enrichedCombatants: Combatant[] = await Promise.all(
    combatantsData.map(async (c) => {
      let name = "Unknown";
      let hpMax = 100;

      if (c.entityType === "PLAYER") {
        const [player] = await db
          .select({ accountId: players.accountId })
          .from(players)
          .where(eq(players.id, c.entityId));
        // For simplicity, use entityId as name
        name = player?.accountId.substring(0, 8) ?? "Player";
        hpMax = 100; // Default player HP
      } else if (c.entityType === "ENEMY") {
        const [enemy] = await db
          .select()
          .from(worldObjects)
          .where(eq(worldObjects.id, c.entityId));
        name = enemy?.name ?? "Enemy";
        const enemyProps = enemy?.rawPropertiesJson
          ? JSON.parse(enemy.rawPropertiesJson)
          : {};
        hpMax = enemyProps.hp ?? 100;
      }

      return {
        id: c.id,
        entityType: c.entityType as "PLAYER" | "ENEMY",
        entityId: c.entityId,
        teamId: c.teamId ?? undefined,
        hpCurrent: c.hpCurrent,
        hpMax,
        initiative: 50, // TODO: calculate from stats
        name,
        isDowned: c.hpCurrent <= 0,
      };
    })
  );

  return {
    id: combat.id,
    type: combat.type as "PVE" | "PVP" | "BOSS",
    state: combat.state as CombatInstance["state"],
    roundNumber: combat.roundNumber,
    startedAt: combat.startedAt,
    combatants: enrichedCombatants,
    actions: actionsData.map((a) => ({
      id: a.id,
      roundNumber: a.roundNumber,
      actorId: a.actorId,
      actionType: a.actionType as ActionType,
      targetId: a.targetId ?? undefined,
      isLocked: a.isLocked,
    })),
  };
}

/**
 * Submit a combat action for a player.
 */
export async function submitCombatAction(opts: {
  combatId: string;
  playerId: string;
  actionType: ActionType;
  targetId?: string;
  idempotencyKey: string;
}): Promise<CombatAction> {
  const { combatId, playerId, actionType, targetId, idempotencyKey } = opts;

  // Get combat instance
  const combat = await getCombatInstance(combatId);

  if (combat.state !== "AWAITING_ACTIONS") {
    throw new Error("Combat is not accepting actions");
  }

  // Check if player is in combat
  const playerCombatant = combat.combatants.find(
    (c) => c.entityId === playerId && c.entityType === "PLAYER"
  );

  if (!playerCombatant) {
    throw new Error("Player not in combat");
  }

  if (playerCombatant.isDowned) {
    throw new Error("Player is downed");
  }

  // Check if player already submitted action for this round
  const existingAction = combat.actions.find(
    (a) => a.actorId === playerCombatant.id && a.roundNumber === combat.roundNumber
  );

  if (existingAction) {
    return existingAction;
  }

  // Insert action
  const [action] = await db
    .insert(combatActions)
    .values({
      combatInstanceId: combatId,
      roundNumber: combat.roundNumber,
      actorId: playerCombatant.id,
      actionType,
      targetId: targetId ?? null,
      isLocked: false,
      idempotencyKey,
    })
    .returning();

  if (!action) {
    throw new Error("Failed to create action");
  }

  return {
    id: action.id,
    roundNumber: action.roundNumber,
    actorId: action.actorId,
    actionType: action.actionType as ActionType,
    targetId: action.targetId ?? undefined,
    isLocked: action.isLocked,
  };
}

/**
 * Schedule auto-lock of round after timer expires.
 */
function scheduleRoundLock(combatId: string, delayMs: number, wsHub?: WsHub) {
  setTimeout(async () => {
    try {
      await lockAndResolveRound(combatId, wsHub);
    } catch (err) {
      console.error(`Failed to auto-lock round for combat ${combatId}:`, err);
    }
  }, delayMs);
}

/**
 * Lock actions and resolve the current round.
 */
export async function lockAndResolveRound(
  combatId: string,
  wsHub?: WsHub
): Promise<CombatLog[]> {
  const combat = await getCombatInstance(combatId);

  if (combat.state !== "AWAITING_ACTIONS") {
    throw new Error("Combat round already locked");
  }

  // Lock combat state
  await db
    .update(combatInstances)
    .set({ state: "LOCKED" })
    .where(eq(combatInstances.id, combatId));

  // Lock all actions
  await db
    .update(combatActions)
    .set({ isLocked: true })
    .where(
      and(
        eq(combatActions.combatInstanceId, combatId),
        eq(combatActions.roundNumber, combat.roundNumber)
      )
    );

  // Resolve round
  const logs = await resolveRound(combatId, wsHub);

  // Check for combat end
  const updatedCombat = await getCombatInstance(combatId);
  const isComplete = checkCombatComplete(updatedCombat);

  if (isComplete) {
    await db
      .update(combatInstances)
      .set({ state: "COMPLETED" })
      .where(eq(combatInstances.id, combatId));

    if (wsHub && updatedCombat.combatants[0]?.teamId) {
      wsHub.sendToTeam(updatedCombat.combatants[0].teamId, {
        event: "combat:completed",
        data: { combatId, logs },
      });
    }
  } else {
    // Start next round
    await db
      .update(combatInstances)
      .set({
        state: "AWAITING_ACTIONS",
        roundNumber: combat.roundNumber + 1,
      })
      .where(eq(combatInstances.id, combatId));

    scheduleRoundLock(combatId, ROUND_TIMER_MS, wsHub);

    if (wsHub && updatedCombat.combatants[0]?.teamId) {
      wsHub.sendToTeam(updatedCombat.combatants[0].teamId, {
        event: "combat:round_resolved",
        data: { combatId, round: combat.roundNumber + 1, logs },
      });
    }
  }

  return logs;
}

/**
 * Resolve all actions in the current round.
 */
async function resolveRound(combatId: string, wsHub?: WsHub): Promise<CombatLog[]> {
  const combat = await getCombatInstance(combatId);
  const logs: CombatLog[] = [];

  // Get actions for current round
  const roundActions = combat.actions.filter(
    (a) => a.roundNumber === combat.roundNumber
  );

  // Add AI actions for enemies
  const enemyCombatants = combat.combatants.filter(
    (c) => c.entityType === "ENEMY" && !c.isDowned
  );

  for (const enemy of enemyCombatants) {
    // Simple AI: attack random player
    const alivePlayers = combat.combatants.filter(
      (c) => c.entityType === "PLAYER" && !c.isDowned
    );

    if (alivePlayers.length > 0) {
      const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

      const [aiAction] = await db
        .insert(combatActions)
        .values({
          combatInstanceId: combatId,
          roundNumber: combat.roundNumber,
          actorId: enemy.id,
          actionType: "ATTACK",
          targetId: target.id,
          isLocked: true,
          idempotencyKey: randomUUID(),
        })
        .returning();

      if (aiAction) {
        roundActions.push({
          id: aiAction.id,
          roundNumber: aiAction.roundNumber,
          actorId: aiAction.actorId,
          actionType: aiAction.actionType as ActionType,
          targetId: aiAction.targetId ?? undefined,
          isLocked: aiAction.isLocked,
        });
      }
    }
  }

  // Sort by initiative (higher goes first)
  const sortedActions = roundActions.sort((a, b) => {
    const actorA = combat.combatants.find((c) => c.id === a.actorId);
    const actorB = combat.combatants.find((c) => c.id === b.actorId);
    return (actorB?.initiative ?? 0) - (actorA?.initiative ?? 0);
  });

  // Execute actions in initiative order
  for (const action of sortedActions) {
    const actor = combat.combatants.find((c) => c.id === action.actorId);
    if (!actor || actor.isDowned) continue;

    if (action.actionType === "ATTACK" && action.targetId) {
      const targetMaybe = combat.combatants.find((c) => c.id === action.targetId);
      const target = targetMaybe;
      if (!target || target.isDowned) continue;

      // Calculate damage
      const damage = calculateDamage(actor, target);

      // Apply damage
      const newHp = Math.max(0, target.hpCurrent - damage);
      await db
        .update(combatants)
        .set({ hpCurrent: newHp })
        .where(eq(combatants.id, target.id));

      logs.push({
        timestamp: new Date(),
        message: `${actor.name} attacks ${target.name} for ${damage} damage!`,
        type: "DAMAGE",
      });

      if (newHp <= 0) {
        logs.push({
          timestamp: new Date(),
          message: `${target.name} is downed!`,
          type: "STATE",
        });

        // Update player status if player
        if (target.entityType === "PLAYER") {
          await db
            .update(players)
            .set({ status: "DOWNED" })
            .where(eq(players.id, target.entityId));
        }
      }

      // Update combatant in memory
      target.hpCurrent = newHp;
      target.isDowned = newHp <= 0;
    } else if (action.actionType === "DEFEND") {
      logs.push({
        timestamp: new Date(),
        message: `${actor.name} takes a defensive stance!`,
        type: "ACTION",
      });
    } else if (action.actionType === "FLEE") {
      logs.push({
        timestamp: new Date(),
        message: `${actor.name} attempts to flee!`,
        type: "ACTION",
      });
    }
  }

  return logs;
}

/**
 * Calculate damage for an attack.
 */
function calculateDamage(attacker: Combatant, defender: Combatant): number {
  // Base damage
  let damage = 10 + Math.floor(Math.random() * 10); // 10-20

  // TODO: Apply attacker's equipped weapon bonuses
  // TODO: Apply defender's equipped armor bonuses
  // TODO: Apply buffs/debuffs

  return Math.max(1, damage);
}

/**
 * Check if combat is complete (all enemies or all players downed).
 */
function checkCombatComplete(combat: CombatInstance): boolean {
  const aliveEnemies = combat.combatants.filter(
    (c) => c.entityType === "ENEMY" && !c.isDowned
  );
  const alivePlayers = combat.combatants.filter(
    (c) => c.entityType === "PLAYER" && !c.isDowned
  );

  return aliveEnemies.length === 0 || alivePlayers.length === 0;
}

/**
 * Get active combat for a team (if any).
 */
export async function getActiveCombatForTeam(
  teamId: string
): Promise<CombatInstance | null> {
  const activeCombats = await db
    .select()
    .from(combatInstances)
    .where(
      inArray(combatInstances.state, ["INITIALIZING", "AWAITING_ACTIONS", "LOCKED", "RESOLVING"])
    );

  for (const combat of activeCombats) {
    const combatantsList = await db
      .select()
      .from(combatants)
      .where(
        and(
          eq(combatants.combatInstanceId, combat.id),
          eq(combatants.teamId, teamId)
        )
      );

    if (combatantsList.length > 0) {
      return getCombatInstance(combat.id);
    }
  }

  return null;
}

/**
 * Handle team wipe - respawn all players with 50% HP.
 */
export async function handleTeamWipe(opts: {
  teamId: string;
  wsHub?: WsHub;
}): Promise<void> {
  const { teamId, wsHub } = opts;

  const teamPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));

  for (const player of teamPlayers) {
    const respawnHp = Math.floor(100 * RESPAWN_HP_PERCENTAGE);
    await db
      .update(players)
      .set({
        hpCurrent: respawnHp,
        status: "ACTIVE",
      })
      .where(eq(players.id, player.id));
  }

  // Deduct denarii penalty
  await db.insert(ledgerEntries).values({
    teamId,
    currencyType: "DENARII",
    amount: -50, // Penalty
    source: "COMBAT",
    idempotencyKey: randomUUID(),
  });

  if (wsHub) {
    wsHub.sendToTeam(teamId, {
      event: "team:wiped",
      data: { message: "Your team has been wiped! Respawning with 50% HP. -50 Denarii." },
    });
  }
}

/**
 * Regenerate HP out of combat.
 */
export async function regenerateHPOutOfCombat(playerId: string): Promise<void> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId));

  if (!player || player.status === "DOWNED") return;

  // Check if player is in combat
  const activeCombat = await getActiveCombatForTeam(player.teamId);
  if (activeCombat) return;

  // Regenerate HP
  const newHp = Math.min(100, player.hpCurrent + HP_REGEN_OUT_OF_COMBAT);
  if (newHp > player.hpCurrent) {
    await db
      .update(players)
      .set({ hpCurrent: newHp })
      .where(eq(players.id, playerId));
  }
}

// ── PvP Challenge System (Epic 6) ────────────────────────────────────────────

/**
 * Check if two teams are within PvP visibility range (60m).
 */
export async function checkPvPProximity(opts: {
  teamId: string;
  playerLat: number;
  playerLng: number;
}): Promise<{
  nearbyTeams: Array<{ teamId: string; teamName: string; distanceM: number }>;
}> {
  const { teamId, playerLat, playerLng } = opts;

  // Get all other teams' last known positions
  const otherTeamPlayers = await db
    .select({
      teamId: players.teamId,
      teamName: teams.name,
      lastLat: players.lastLat,
      lastLng: players.lastLng,
    })
    .from(players)
    .innerJoin(teams, eq(teams.id, players.teamId))
    .where(and(
      sql`${players.teamId} != ${teamId}`,
      sql`${players.lastLat} IS NOT NULL`,
      sql`${players.lastLng} IS NOT NULL`
    ));

  const nearbyTeams: Array<{ teamId: string; teamName: string; distanceM: number }> = [];

  for (const otherPlayer of otherTeamPlayers) {
    if (!otherPlayer.lastLat || !otherPlayer.lastLng) continue;

    // Calculate distance using PostGIS
    const result = await db.execute<{ distance_m: string }>(sql`
      SELECT ST_DistanceSphere(
        ST_MakePoint(${playerLng}, ${playerLat}),
        ST_MakePoint(${otherPlayer.lastLng}, ${otherPlayer.lastLat})
      ) AS distance_m
    `);

    const rows = result.rows as { distance_m: string }[];
    const distanceM = parseFloat(rows[0]?.distance_m ?? "Infinity");

    if (distanceM <= PVP_VISIBILITY_RADIUS_M) {
      nearbyTeams.push({
        teamId: otherPlayer.teamId,
        teamName: otherPlayer.teamName,
        distanceM,
      });
    }
  }

  return { nearbyTeams };
}

/**
 * Check if a location is in a safe zone.
 */
export async function isInSafeZone(opts: {
  lat: number;
  lng: number;
}): Promise<boolean> {
  const { lat, lng } = opts;

  // Query for nearby SAFE_ZONE WorldObjects
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count
    FROM world_object wo
    WHERE
      wo.type = 'SAFE_ZONE'
      AND wo.geom IS NOT NULL
      AND wo.publishable = true
      AND ST_DWithin(
        wo.geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        wo.interaction_radius_m
      )
  `);

  const rows = result.rows as { count: string }[];
  const count = parseInt(rows[0]?.count ?? "0");

  return count > 0;
}

/**
 * Start a PvP challenge between two teams.
 * Creates a WARNING state that lasts 20 seconds before combat starts.
 */
export async function startPvPChallenge(opts: {
  attackerTeamId: string;
  defenderTeamId: string;
  wsHub?: WsHub;
}): Promise<{
  challengeId: string;
  expiresAt: Date;
}> {
  const { attackerTeamId, defenderTeamId, wsHub } = opts;

  // Check if either team is already in combat
  const attackerCombat = await getActiveCombatForTeam(attackerTeamId);
  const defenderCombat = await getActiveCombatForTeam(defenderTeamId);

  if (attackerCombat || defenderCombat) {
    throw new Error("One or both teams are already in combat");
  }

  // Check if defender is in safe zone
  const [defenderPlayer] = await db
    .select({ lastLat: players.lastLat, lastLng: players.lastLng })
    .from(players)
    .where(eq(players.teamId, defenderTeamId))
    .limit(1);

  if (defenderPlayer?.lastLat && defenderPlayer?.lastLng) {
    const inSafeZone = await isInSafeZone({
      lat: defenderPlayer.lastLat,
      lng: defenderPlayer.lastLng,
    });

    if (inSafeZone) {
      throw new Error("Defender is in a safe zone - PvP not allowed");
    }
  }

  // Create PvP challenge
  const expiresAt = new Date(Date.now() + PVP_WARNING_TIMER_MS);

  const [challenge] = await db
    .insert(pvpChallenges)
    .values({
      attackerTeamId,
      defenderTeamId,
      state: "WARNING",
      expiresAt,
    })
    .returning();

  // Emit WS events to both teams
  if (wsHub) {
    wsHub.sendToTeam(attackerTeamId, {
      event: "pvp:challenge_started",
      data: {
        challengeId: challenge.id,
        role: "attacker",
        opponentTeamId: defenderTeamId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    wsHub.sendToTeam(defenderTeamId, {
      event: "pvp:challenge_started",
      data: {
        challengeId: challenge.id,
        role: "defender",
        opponentTeamId: attackerTeamId,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  // Schedule auto-escalation to combat
  schedulePvPEscalation(challenge.id, PVP_WARNING_TIMER_MS, wsHub);

  return {
    challengeId: challenge.id,
    expiresAt,
  };
}

/**
 * Schedule PvP challenge escalation to combat.
 */
function schedulePvPEscalation(challengeId: string, delayMs: number, wsHub?: WsHub) {
  setTimeout(async () => {
    try {
      await escalatePvPChallenge(challengeId, wsHub);
    } catch (err) {
      console.error(`Failed to escalate PvP challenge ${challengeId}:`, err);
    }
  }, delayMs);
}

/**
 * Escalate PvP challenge to combat after warning period.
 */
async function escalatePvPChallenge(challengeId: string, wsHub?: WsHub): Promise<void> {
  const challenges = await db
    .select()
    .from(pvpChallenges)
    .where(eq(pvpChallenges.id, challengeId));

  const challenge = challenges[0];
  if (!challenge || challenge.state !== "WARNING") {
    return; // Already resolved
  }

  // Check if defender escaped (GPS validation)
  const [attacker] = await db
    .select({ lastLat: players.lastLat, lastLng: players.lastLng })
    .from(players)
    .where(eq(players.teamId, challenge.attackerTeamId))
    .limit(1);

  const [defender] = await db
    .select({ lastLat: players.lastLat, lastLng: players.lastLng })
    .from(players)
    .where(eq(players.teamId, challenge.defenderTeamId))
    .limit(1);

  if (!attacker?.lastLat || !attacker?.lastLng || !defender?.lastLat || !defender?.lastLng) {
    // Missing GPS data, mark as escaped
    await db
      .update(pvpChallenges)
      .set({ state: "ESCAPED" })
      .where(eq(pvpChallenges.id, challengeId));
    return;
  }

  // Calculate current distance
  const result = await db.execute<{ distance_m: string }>(sql`
    SELECT ST_DistanceSphere(
      ST_MakePoint(${attacker.lastLng}, ${attacker.lastLat}),
      ST_MakePoint(${defender.lastLng}, ${defender.lastLat})
    ) AS distance_m
  `);

  const rows = result.rows as { distance_m: string }[];
  const distanceM = parseFloat(rows[0]?.distance_m ?? "Infinity");

  if (distanceM > PVP_AGGRO_RADIUS_M) {
    // Defender escaped!
    await db
      .update(pvpChallenges)
      .set({ state: "ESCAPED" })
      .where(eq(pvpChallenges.id, challengeId));

    if (wsHub) {
      wsHub.sendToTeam(challenge.attackerTeamId, {
        event: "pvp:challenge_escaped",
        data: { challengeId },
      });
      wsHub.sendToTeam(challenge.defenderTeamId, {
        event: "pvp:challenge_escaped",
        data: { challengeId },
      });
    }
    return;
  }

  // Check safe zone
  const inSafeZone = await isInSafeZone({
    lat: defender.lastLat,
    lng: defender.lastLng,
  });

  if (inSafeZone) {
    // Defender reached safe zone
    await db
      .update(pvpChallenges)
      .set({ state: "ESCAPED" })
      .where(eq(pvpChallenges.id, challengeId));

    if (wsHub) {
      wsHub.sendToTeam(challenge.attackerTeamId, {
        event: "pvp:challenge_escaped",
        data: { challengeId, reason: "safe_zone" },
      });
      wsHub.sendToTeam(challenge.defenderTeamId, {
        event: "pvp:challenge_escaped",
        data: { challengeId, reason: "safe_zone" },
      });
    }
    return;
  }

  // Start PvP combat!
  await db
    .update(pvpChallenges)
    .set({ state: "COMBAT" })
    .where(eq(pvpChallenges.id, challengeId));

  try {
    await startPvPCombat({
      attackerTeamId: challenge.attackerTeamId,
      defenderTeamId: challenge.defenderTeamId,
      wsHub,
    });
  } catch (err) {
    console.error("Failed to start PvP combat:", err);
  }
}

/**
 * Start PvP combat between two teams.
 */
async function startPvPCombat(opts: {
  attackerTeamId: string;
  defenderTeamId: string;
  wsHub?: WsHub;
}): Promise<CombatInstance> {
  const { attackerTeamId, defenderTeamId, wsHub } = opts;

  // Get both teams' players
  const attackerPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, attackerTeamId));

  const defenderPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, defenderTeamId));

  if (attackerPlayers.length === 0 || defenderPlayers.length === 0) {
    throw new Error("One or both teams have no players");
  }

  // Create combat instance
  const [combat] = await db
    .insert(combatInstances)
    .values({
      type: "PVP",
      state: "INITIALIZING",
      roundNumber: 0,
    })
    .returning();

  // Create combatants for both teams
  await Promise.all([
    ...attackerPlayers.map(async (player) => {
      await db.insert(combatants).values({
        combatInstanceId: combat.id,
        entityType: "PLAYER",
        entityId: player.id,
        teamId: player.teamId,
        hpCurrent: player.hpCurrent,
      });
    }),
    ...defenderPlayers.map(async (player) => {
      await db.insert(combatants).values({
        combatInstanceId: combat.id,
        entityType: "PLAYER",
        entityId: player.id,
        teamId: player.teamId,
        hpCurrent: player.hpCurrent,
      });
    }),
  ]);

  // Start round 1
  await db
    .update(combatInstances)
    .set({
      state: "AWAITING_ACTIONS",
      roundNumber: 1,
    })
    .where(eq(combatInstances.id, combat.id));

  scheduleRoundLock(combat.id, ROUND_TIMER_MS, wsHub);

  // Emit WS events
  if (wsHub) {
    wsHub.sendToTeam(attackerTeamId, {
      event: "combat:started",
      data: { combatId: combat.id, type: "PVP", opponentTeamId: defenderTeamId },
    });
    wsHub.sendToTeam(defenderTeamId, {
      event: "combat:started",
      data: { combatId: combat.id, type: "PVP", opponentTeamId: attackerTeamId },
    });
  }

  return getCombatInstance(combat.id);
}
