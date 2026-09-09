/**
 * GM Commands Service – Epic 9
 * Reversible, audit-logged commands for game master intervention.
 * All actions are logged to the audit_event table.
 */

import type { FastifyBaseLogger } from "fastify";
import { db } from "../../db/client.js";
import { auditEvents, eventState } from "../../db/schema/media.js";
import { questRuns, objectiveProgress } from "../../db/schema/quest.js";
import { teams, players } from "../../db/schema/player.js";
import { ledgerEntries } from "../../db/schema/economy_v2.js";
import { appendLedgerEntry } from "../economy/ledger.service.js";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type GMCommandType =
  | "QUEST_RESET"
  | "HP_OVERRIDE"
  | "LOCATION_OVERRIDE"
  | "CURRENCY_CORRECTION"
  | "ITEM_GRANT"
  | "EVENT_CONTROL";

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetRefs: string | null;
  payload: unknown;
  createdAt: string;
}

export class GMCommandService {
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ module: "GMCommandService" });
  }

  /**
   * Log a GM command to audit_event table.
   */
  private async logAudit(
    actorId: string,
    action: GMCommandType,
    targetRefs: string | null,
    payload: unknown,
  ): Promise<void> {
    await db.insert(auditEvents).values({
      actorId,
      action,
      targetRefs,
      payload: payload as any,
    });

    this.logger.info({ actorId, action, targetRefs }, "GM command executed");
  }

  /**
   * QUEST_RESET: Reset a quest run to ACTIVE state and clear progress.
   * Reversible by re-accepting the quest.
   */
  async resetQuest(
    actorId: string,
    questRunId: string,
  ): Promise<{ success: boolean; message: string }> {
    const [questRun] = await db
      .select()
      .from(questRuns)
      .where(eq(questRuns.id, questRunId))
      .limit(1);

    if (!questRun) {
      throw new Error("Quest run not found");
    }

    // Store previous state for audit
    const previousState = questRun.state;

    // Reset quest run to ACTIVE
    await db
      .update(questRuns)
      .set({
        state: "ACTIVE",
        completedAt: null,
        acceptedAt: new Date(),
      })
      .where(eq(questRuns.id, questRunId));

    // Clear objective progress
    await db
      .delete(objectiveProgress)
      .where(eq(objectiveProgress.questRunId, questRunId));

    await this.logAudit(actorId, "QUEST_RESET", questRunId, {
      questRunId,
      previousState,
      teamId: questRun.teamId,
    });

    return {
      success: true,
      message: `Quest ${questRunId} reset from ${previousState} to ACTIVE`,
    };
  }

  /**
   * HP_OVERRIDE: Directly set a team's HP value.
   * Use for emergency corrections or event balancing.
   */
  async overrideHP(
    actorId: string,
    teamId: string,
    newHP: number,
  ): Promise<{ success: boolean; message: string; previousHP: number }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      throw new Error("Team not found");
    }

    const previousHP = team.hp;

    await db.update(teams).set({ hp: newHP }).where(eq(teams.id, teamId));

    await this.logAudit(actorId, "HP_OVERRIDE", teamId, {
      teamId,
      previousHP,
      newHP,
    });

    return {
      success: true,
      message: `Team ${team.name} HP changed from ${previousHP} to ${newHP}`,
      previousHP,
    };
  }

  /**
   * LOCATION_OVERRIDE: Manually set a player's location.
   * Use for stuck players or location bugs.
   */
  async overrideLocation(
    actorId: string,
    playerId: string,
    lat: number,
    lng: number,
  ): Promise<{ success: boolean; message: string }> {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      throw new Error("Player not found");
    }

    const previousLocation = {
      lat: player.lastLat,
      lng: player.lastLng,
    };

    await db
      .update(players)
      .set({
        lastLat: lat,
        lastLng: lng,
        lastLocationUpdate: new Date(),
      })
      .where(eq(players.id, playerId));

    await this.logAudit(actorId, "LOCATION_OVERRIDE", playerId, {
      playerId,
      previousLocation,
      newLocation: { lat, lng },
    });

    return {
      success: true,
      message: `Player ${player.playerName} location overridden`,
    };
  }

  /**
   * CURRENCY_CORRECTION: Add or subtract currency (FAME/DENARII).
   * Creates a ledger entry with source=ADMIN.
   * Supports negative amounts for corrections.
   */
  async correctCurrency(
    actorId: string,
    teamId: string,
    currencyType: "FAME" | "DENARII",
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      throw new Error("Team not found");
    }

    const idempotencyKey = randomUUID();

    await appendLedgerEntry({
      idempotencyKey,
      teamId,
      currencyType,
      amount,
      source: "ADMIN",
    });

    await this.logAudit(actorId, "CURRENCY_CORRECTION", teamId, {
      teamId,
      currencyType,
      amount,
      reason,
      idempotencyKey,
    });

    return {
      success: true,
      message: `${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount)} ${currencyType} ${amount > 0 ? "to" : "from"} team ${team.name}`,
    };
  }

  /**
   * Get audit log with pagination and filtering.
   */
  async getAuditLog(opts: {
    limit?: number;
    offset?: number;
    actorId?: string;
    action?: GMCommandType;
  }): Promise<AuditLog[]> {
    const { limit = 50, offset = 0, actorId: filterActorId, action } = opts;

    let query = db.select().from(auditEvents);

    if (filterActorId) {
      query = query.where(eq(auditEvents.actorId, filterActorId)) as any;
    }

    if (action) {
      const condition = eq(auditEvents.action, action);
      query = filterActorId
        ? (query.where(
            and(eq(auditEvents.actorId, filterActorId), condition),
          ) as any)
        : (query.where(condition) as any);
    }

    const results = await query
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      targetRefs: r.targetRefs,
      payload: r.payload,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Get event state.
   */
  async getEventState() {
    const [state] = await db.select().from(eventState).limit(1);
    
    if (!state) {
      throw new Error("Event state not found");
    }

    return {
      ...state,
      startedAt: state.startedAt?.toISOString() ?? null,
      pausedAt: state.pausedAt?.toISOString() ?? null,
      endedAt: state.endedAt?.toISOString() ?? null,
      updatedAt: state.updatedAt.toISOString(),
    };
  }
}
