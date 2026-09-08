/**
 * Quest Service – Epic 4 Flow-Phase State Machine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Drives the full DISCOVER → DIALOGUE → ACCEPT → OBJECTIVE → COMPLETE lifecycle.
 *
 * Public API:
 *   getActiveRuns(teamId)              → QuestRunDetail[] for active runs
 *   getAvailableQuests(teamId)         → Quests in proximity, not yet accepted
 *   acceptQuest(opts)                  → Create QuestRun; enforce slot ≤ 3
 *   validateReachLocation(opts)        → PostGIS distance check for REACH_LOCATION
 *   submitAnswer(opts)                 → Answer check for ANSWER_QUESTION/SOLVE_PUZZLE
 *   completeQuest(opts)                → Finalize run after all objectives done
 *
 * Flow-phase logic (pre-accept):
 *   Proximity zone DISCOVERED  → discoveryPhase = "DISCOVER"
 *   Proximity zone INTERACTING → discoveryPhase = "DIALOGUE"
 *
 * WorldObject externalId convention:
 *   The GeoJSON seeds WorldObjects with Feature.id as externalId, e.g.
 *   "location:place_day_1_acquedotto_vergine".
 *   QuestStep.targetRef stores only the candidate_id part:
 *   "place_day_1_acquedotto_vergine".
 *   lookupWorldObjectByTargetRef() handles the "location:" prefix resolution.
 *
 * Team-sync requirement (ANSWER_QUESTION / SOLVE_PUZZLE):
 *   All team members must be connected via WebSocket when submitting an answer.
 *   Pass opts.requireAllMembersOnline = true from the route handler to enforce.
 */

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  objectiveProgress,
  questDefinitions,
  questRuns,
  questStations,
  questSteps,
} from "../../db/schema/quest.js";
import { players } from "../../db/schema/player.js";
import { worldObjects } from "../../db/schema/world.js";
import { playerProximityStates } from "../../db/schema/proximity.js";
import { checkEffectiveDistance } from "../geo/geo.service.js";
import type { WsHub } from "../ws/ws.hub.js";
import type {
  QuestAcceptedEvent,
  QuestAvailable,
  QuestCompletedEvent,
  QuestRunDetail,
  QuestStep,
  QuestStepCompletedEvent,
  StepResult,
} from "@jlw/contracts";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ACTIVE_QUESTS = 3;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve accountId → { playerId, teamId, playerName }.
 * Throws a 404-shaped Error if no player record exists.
 */
async function resolvePlayer(accountId: string): Promise<{
  playerId: string;
  teamId: string;
  playerName: string;
}> {
  const rows = await db.execute<{
    player_id: string;
    team_id: string;
    username: string;
  }>(sql`
    SELECT p.id   AS player_id,
           p.team_id,
           a.username
    FROM   player  p
    JOIN   account a ON a.id = p.account_id
    WHERE  p.account_id = ${accountId}
  `);

  const row = (
    rows.rows as { player_id: string; team_id: string; username: string }[]
  )[0];

  if (!row) {
    const err = new Error(
      "No player record found for this account.",
    ) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return {
    playerId: row.player_id,
    teamId: row.team_id,
    playerName: row.username,
  };
}

/**
 * Look up a WorldObject whose externalId matches the step's targetRef.
 *
 * GeoJSON seeds WorldObjects with Feature.id (e.g. "location:place_xyz"),
 * but QuestStep.targetRef stores only the candidateId ("place_xyz").
 * We try both the raw targetRef and the "location:" prefixed form.
 */
async function lookupWorldObjectByTargetRef(
  targetRef: string,
): Promise<(typeof worldObjects.$inferSelect) | null> {
  // Try direct match first (handles enemy_encounter refs like "enemy:UE-D1-01").
  let [wo] = await db
    .select()
    .from(worldObjects)
    .where(eq(worldObjects.externalId, targetRef));

  if (!wo) {
    // Try prefixed with "location:"
    [wo] = await db
      .select()
      .from(worldObjects)
      .where(eq(worldObjects.externalId, `location:${targetRef}`));
  }

  return wo ?? null;
}

/**
 * Build a QuestRunDetail from a raw quest_run row + definition metadata.
 * Loads all OBJECTIVE steps and their ObjectiveProgress records.
 */
async function buildQuestRunDetail(
  run: typeof questRuns.$inferSelect & {
    questTitle: string;
    questType: string;
    questDay: string | null;
  },
): Promise<QuestRunDetail> {
  // Load all OBJECTIVE-phase steps ordered by sequence
  const steps = await db
    .select()
    .from(questSteps)
    .where(
      and(
        eq(questSteps.questDefinitionId, run.questDefinitionId),
        eq(questSteps.flowPhase, "OBJECTIVE"),
      ),
    )
    .orderBy(questSteps.sequence);

  // Load existing ObjectiveProgress for this run
  const progressRows = await db
    .select()
    .from(objectiveProgress)
    .where(eq(objectiveProgress.questRunId, run.id));

  const progressMap = new Map(progressRows.map((p) => [p.objectiveId, p]));

  // Merge steps with progress
  const objectives = steps.map((step) => {
    const prog = progressMap.get(step.stepId);
    return {
      id: step.id,
      stepId: step.stepId,
      sequence: step.sequence,
      flowPhase: step.flowPhase as QuestStep["flowPhase"],
      stepActionType: step.stepActionType as QuestStep["stepActionType"],
      stepCategory: step.stepCategory,
      gddObjectiveType: step.gddObjectiveType,
      targetRef: step.targetRef,
      required: step.required,
      progress: prog
        ? {
            objectiveId: prog.objectiveId,
            status: prog.status as "PENDING" | "COMPLETED" | "SKIPPED",
            progressCount: prog.progressCount,
          }
        : null,
    };
  });

  // Current step = first required OBJECTIVE step that is not yet COMPLETED
  const currentStep =
    objectives.find((o) => {
      if (!o.required) return false;
      return !o.progress || o.progress.status === "PENDING";
    }) ?? null;

  const toIso = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  return {
    id: run.id,
    teamId: run.teamId,
    questDefinitionId: run.questDefinitionId,
    state: run.state as QuestRunDetail["state"],
    startedAt: toIso(run.startedAt),
    completedAt: run.completedAt ? toIso(run.completedAt) : null,
    questTitle: run.questTitle,
    questType: run.questType as QuestRunDetail["questType"],
    questDay: run.questDay,
    currentStep: currentStep
      ? {
          id: currentStep.id,
          stepId: currentStep.stepId,
          sequence: currentStep.sequence,
          flowPhase: currentStep.flowPhase,
          stepActionType: currentStep.stepActionType,
          stepCategory: currentStep.stepCategory,
          gddObjectiveType: currentStep.gddObjectiveType,
          targetRef: currentStep.targetRef,
          required: currentStep.required,
        }
      : null,
    objectives,
  };
}

// ── Internal: mark one objective step as COMPLETED ────────────────────────────

async function completeObjectiveStep(opts: {
  questRunId: string;
  stepId: string;
  stepActionType: string;
  run: typeof questRuns.$inferSelect;
  playerName: string;
  wsHub?: WsHub;
}): Promise<{ allRequiredDone: boolean }> {
  const { questRunId, stepId, stepActionType, run, playerName, wsHub } = opts;

  // Upsert ObjectiveProgress → COMPLETED
  await db
    .insert(objectiveProgress)
    .values({
      questRunId,
      objectiveId: stepId,
      status: "COMPLETED",
      progressCount: 1,
    })
    .onConflictDoUpdate({
      target: [objectiveProgress.questRunId, objectiveProgress.objectiveId],
      set: {
        status: sql`'COMPLETED'`,
        progressCount: sql`${objectiveProgress.progressCount} + 1`,
      },
    });

  // Load quest definition for title
  const [questDef] = await db
    .select({ title: questDefinitions.title })
    .from(questDefinitions)
    .where(eq(questDefinitions.id, run.questDefinitionId));

  // Re-check: are all required objectives completed now?
  const allSteps = await db
    .select({ step: questSteps, progress: objectiveProgress })
    .from(questSteps)
    .leftJoin(
      objectiveProgress,
      and(
        eq(objectiveProgress.questRunId, questRunId),
        eq(objectiveProgress.objectiveId, questSteps.stepId),
      ),
    )
    .where(
      and(
        eq(questSteps.questDefinitionId, run.questDefinitionId),
        eq(questSteps.flowPhase, "OBJECTIVE"),
        eq(questSteps.required, true),
      ),
    );

  const allRequiredDone = allSteps.every(
    (s) => s.progress?.status === "COMPLETED",
  );

  // Find the next pending step for the WS event payload
  const nextPendingRow = !allRequiredDone
    ? allSteps.find(
        (s) => !s.progress || s.progress.status === "PENDING",
      ) ?? null
    : null;

  const nextStep: QuestStep | null = nextPendingRow
    ? {
        id: nextPendingRow.step.id,
        stepId: nextPendingRow.step.stepId,
        sequence: nextPendingRow.step.sequence,
        flowPhase: nextPendingRow.step.flowPhase as QuestStep["flowPhase"],
        stepActionType:
          nextPendingRow.step.stepActionType as QuestStep["stepActionType"],
        stepCategory: nextPendingRow.step.stepCategory,
        gddObjectiveType: nextPendingRow.step.gddObjectiveType,
        targetRef: nextPendingRow.step.targetRef,
        required: nextPendingRow.step.required,
      }
    : null;

  // Broadcast quest.step_completed to all team members
  if (wsHub) {
    const event: QuestStepCompletedEvent = {
      event: "quest.step_completed",
      teamId: run.teamId,
      questRunId,
      questTitle: questDef?.title ?? "Quest",
      stepId,
      stepActionType: stepActionType as QuestStep["stepActionType"],
      completedByPlayerName: playerName,
      nextStep,
      timestamp: new Date().toISOString(),
    };
    wsHub.sendToTeam(run.teamId, event);
  }

  return { allRequiredDone };
}

// ── Public: getActiveRuns ─────────────────────────────────────────────────────

/**
 * Return all ACTIVE QuestRuns for a team, enriched with step progress.
 */
export async function getActiveRuns(teamId: string): Promise<QuestRunDetail[]> {
  const rows = await db.execute<{
    id: string;
    team_id: string;
    quest_definition_id: string;
    state: string;
    started_at: Date;
    completed_at: Date | null;
    quest_title: string;
    quest_type: string;
    quest_day: string | null;
  }>(sql`
    SELECT qr.id,
           qr.team_id,
           qr.quest_definition_id,
           qr.state,
           qr.started_at,
           qr.completed_at,
           qd.title  AS quest_title,
           qd.type   AS quest_type,
           qd.day    AS quest_day
    FROM   quest_run        qr
    JOIN   quest_definition qd ON qd.id = qr.quest_definition_id
    WHERE  qr.team_id = ${teamId}
      AND  qr.state   = 'ACTIVE'
    ORDER  BY qr.started_at ASC
  `);

  const result: QuestRunDetail[] = [];

  for (const row of rows.rows as (typeof rows.rows)[number][]) {
    const r = row as {
      id: string;
      team_id: string;
      quest_definition_id: string;
      state: string;
      started_at: Date;
      completed_at: Date | null;
      quest_title: string;
      quest_type: string;
      quest_day: string | null;
    };

    result.push(
      await buildQuestRunDetail({
        id: r.id,
        teamId: r.team_id,
        questDefinitionId: r.quest_definition_id,
        state: r.state as "ACTIVE",
        startedAt: r.started_at,
        completedAt: r.completed_at,
        questTitle: r.quest_title,
        questType: r.quest_type,
        questDay: r.quest_day,
      }),
    );
  }

  return result;
}

// ── Public: getAvailableQuests ────────────────────────────────────────────────

/**
 * Return QuestDefinitions that at least one team member can currently discover
 * (proximity zone DISCOVERED or INTERACTING) but that the team hasn't
 * accepted yet (no active QuestRun).
 *
 * HIDDEN quests are included once the trigger WorldObject is in range
 * (they are filtered by type only in the active quest list UI, not here).
 */
export async function getAvailableQuests(
  teamId: string,
): Promise<QuestAvailable[]> {
  // Step 1: Player IDs for this team
  const teamPlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.teamId, teamId));

  if (teamPlayers.length === 0) return [];

  const playerIds = teamPlayers.map((p) => p.id);

  // Step 2: WorldObjects in DISCOVERED or INTERACTING zone for any team member
  const proximityRows = await db
    .select({
      worldObjectId: playerProximityStates.worldObjectId,
      zone: playerProximityStates.zone,
    })
    .from(playerProximityStates)
    .where(
      and(
        inArray(playerProximityStates.playerId, playerIds),
        inArray(playerProximityStates.zone, ["DISCOVERED", "INTERACTING"]),
      ),
    );

  if (proximityRows.length === 0) return [];

  // Prefer INTERACTING over DISCOVERED if multiple team members see the same object
  const worldObjectZoneMap = new Map<string, string>();
  for (const row of proximityRows) {
    const existing = worldObjectZoneMap.get(row.worldObjectId);
    if (!existing || (existing === "DISCOVERED" && row.zone === "INTERACTING")) {
      worldObjectZoneMap.set(row.worldObjectId, row.zone);
    }
  }

  const nearbyObjectIds = [...worldObjectZoneMap.keys()];

  // Step 3: QuestDefinitions linked via QuestStation to these WorldObjects
  const stationRows = await db
    .select({
      questDefinitionId: questStations.questDefinitionId,
      worldObjectId: questStations.worldObjectId,
    })
    .from(questStations)
    .where(inArray(questStations.worldObjectId, nearbyObjectIds));

  if (stationRows.length === 0) return [];

  const questDefIds = [...new Set(stationRows.map((r) => r.questDefinitionId))];

  // Step 4: Exclude already-active QuestRuns
  const activeRuns = await db
    .select({ questDefinitionId: questRuns.questDefinitionId })
    .from(questRuns)
    .where(
      and(
        eq(questRuns.teamId, teamId),
        eq(questRuns.state, "ACTIVE"),
        inArray(questRuns.questDefinitionId, questDefIds),
      ),
    );

  const activeDefIds = new Set(activeRuns.map((r) => r.questDefinitionId));
  const availableIds = questDefIds.filter((id) => !activeDefIds.has(id));

  if (availableIds.length === 0) return [];

  // Step 5: Load QuestDefinition rows
  const questDefs = await db
    .select()
    .from(questDefinitions)
    .where(inArray(questDefinitions.id, availableIds));

  // Step 6: Load WorldObject names for trigger objects
  const worldObjectRows = await db
    .select({ id: worldObjects.id, name: worldObjects.name })
    .from(worldObjects)
    .where(inArray(worldObjects.id, nearbyObjectIds));

  const worldObjectNameMap = new Map(worldObjectRows.map((r) => [r.id, r.name]));

  // Build result
  return questDefs.map((qd): QuestAvailable => {
    const trigger = stationRows.find((s) => s.questDefinitionId === qd.id)!;
    const zone = worldObjectZoneMap.get(trigger.worldObjectId) ?? "DISCOVERED";

    return {
      questDefinitionId: qd.id,
      externalId: qd.externalId,
      title: qd.title,
      type: qd.type as QuestAvailable["type"],
      day: qd.day,
      discoveryPhase: zone === "INTERACTING" ? "DIALOGUE" : "DISCOVER",
      triggerObjectId: trigger.worldObjectId,
      triggerObjectName: worldObjectNameMap.get(trigger.worldObjectId) ?? "?",
    };
  });
}

// ── Public: acceptQuest ───────────────────────────────────────────────────────

/**
 * Accept a quest for the team.
 *
 * - Enforces the 3-slot limit.
 * - Idempotent: returns the existing run if already accepted.
 * - Creates ObjectiveProgress rows for all OBJECTIVE steps.
 * - Broadcasts quest.accepted to all team members.
 */
export async function acceptQuest(opts: {
  accountId: string;
  questDefinitionId: string;
  wsHub?: WsHub;
}): Promise<{ run: QuestRunDetail; alreadyActive: boolean }> {
  const { accountId, questDefinitionId, wsHub } = opts;

  const { teamId, playerName } = await resolvePlayer(accountId);

  // Load quest definition
  const [questDef] = await db
    .select()
    .from(questDefinitions)
    .where(eq(questDefinitions.id, questDefinitionId));

  if (!questDef) {
    const err = new Error("Quest definition not found.") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  // Idempotency: return existing active run
  const [existingRun] = await db
    .select()
    .from(questRuns)
    .where(
      and(
        eq(questRuns.teamId, teamId),
        eq(questRuns.questDefinitionId, questDefinitionId),
        eq(questRuns.state, "ACTIVE"),
      ),
    );

  if (existingRun) {
    const detail = await buildQuestRunDetail({
      ...existingRun,
      questTitle: questDef.title,
      questType: questDef.type,
      questDay: questDef.day,
    });
    return { run: detail, alreadyActive: true };
  }

  // Slot check: max MAX_ACTIVE_QUESTS active quests per team
  const activeCountResult = await db
    .select({ count: count() })
    .from(questRuns)
    .where(and(eq(questRuns.teamId, teamId), eq(questRuns.state, "ACTIVE")));

  const activeCount = Number(activeCountResult[0]?.count ?? 0);

  if (activeCount >= MAX_ACTIVE_QUESTS) {
    const err = new Error(
      `Maximum ${MAX_ACTIVE_QUESTS} active quests per team. Finish one first.`,
    ) as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  // Create the QuestRun
  const [newRun] = await db
    .insert(questRuns)
    .values({ teamId, questDefinitionId, state: "ACTIVE" })
    .returning();

  if (!newRun) throw new Error("Failed to create QuestRun.");

  // Initialise ObjectiveProgress for every OBJECTIVE step
  const objectiveSteps = await db
    .select()
    .from(questSteps)
    .where(
      and(
        eq(questSteps.questDefinitionId, questDefinitionId),
        eq(questSteps.flowPhase, "OBJECTIVE"),
      ),
    )
    .orderBy(questSteps.sequence);

  if (objectiveSteps.length > 0) {
    await db.insert(objectiveProgress).values(
      objectiveSteps.map((step) => ({
        questRunId: newRun.id,
        objectiveId: step.stepId,
        status: "PENDING",
        progressCount: 0,
      })),
    );
  }

  // Broadcast quest.accepted
  if (wsHub) {
    const event: QuestAcceptedEvent = {
      event: "quest.accepted",
      teamId,
      questRunId: newRun.id,
      questTitle: questDef.title,
      acceptedByPlayerName: playerName,
      timestamp: new Date().toISOString(),
    };
    wsHub.sendToTeam(teamId, event);
  }

  const detail = await buildQuestRunDetail({
    ...newRun,
    questTitle: questDef.title,
    questType: questDef.type,
    questDay: questDef.day,
  });

  return { run: detail, alreadyActive: false };
}

// ── Public: validateReachLocation ────────────────────────────────────────────

/**
 * Validate that the player is within the interaction radius of the OBJECTIVE
 * step's target location using PostGIS.
 *
 * On success: marks the step COMPLETED, broadcasts quest.step_completed.
 */
export async function validateReachLocation(opts: {
  accountId: string;
  questRunId: string;
  stepId: string;
  lat: number;
  lng: number;
  accuracy: number;
  wsHub?: WsHub;
}): Promise<StepResult> {
  const { accountId, questRunId, stepId, lat, lng, accuracy, wsHub } = opts;

  const { teamId, playerName } = await resolvePlayer(accountId);

  // Load QuestRun
  const [run] = await db
    .select()
    .from(questRuns)
    .where(
      and(
        eq(questRuns.id, questRunId),
        eq(questRuns.teamId, teamId),
        eq(questRuns.state, "ACTIVE"),
      ),
    );

  if (!run) {
    const err = new Error("QuestRun not found or not active.") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  // Load the target step
  const [step] = await db
    .select()
    .from(questSteps)
    .where(
      and(
        eq(questSteps.questDefinitionId, run.questDefinitionId),
        eq(questSteps.stepId, stepId),
        eq(questSteps.flowPhase, "OBJECTIVE"),
        eq(questSteps.stepActionType, "REACH_LOCATION"),
      ),
    );

  if (!step) {
    const err = new Error(
      "Step not found or not a REACH_LOCATION step.",
    ) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Verify this is the current active (pending) step
  const [currentProgress] = await db
    .select()
    .from(objectiveProgress)
    .where(
      and(
        eq(objectiveProgress.questRunId, questRunId),
        eq(objectiveProgress.objectiveId, stepId),
      ),
    );

  if (currentProgress?.status === "COMPLETED") {
    return {
      stepId,
      status: "COMPLETED",
      message: "Dieser Schritt ist bereits abgeschlossen.",
    };
  }

  // Look up the target WorldObject
  const targetObj = await lookupWorldObjectByTargetRef(step.targetRef);

  if (!targetObj || targetObj.lat == null || targetObj.lng == null) {
    const err = new Error("Target location not found or has no coordinates.") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  // PostGIS distance check
  const distCheck = await checkEffectiveDistance({
    playerLat: lat,
    playerLng: lng,
    targetLat: targetObj.lat,
    targetLng: targetObj.lng,
    accuracy,
    targetRadius: targetObj.interactionRadiusM,
  });

  if (!distCheck.withinRange) {
    const remaining = Math.ceil(
      distCheck.effectiveDistanceM - targetObj.interactionRadiusM,
    );
    return {
      stepId,
      status: "FAILED",
      message: `Noch ${remaining} m entfernt. Kommt näher!`,
    };
  }

  // Mark completed & broadcast
  const { allRequiredDone } = await completeObjectiveStep({
    questRunId,
    stepId,
    stepActionType: "REACH_LOCATION",
    run,
    playerName,
    ...(wsHub ? { wsHub } : {}),
  });

  return {
    stepId,
    status: "COMPLETED",
    message: "Standort bestätigt! ✓",
    questCompleted: allRequiredDone,
  };
}

// ── Public: submitAnswer ──────────────────────────────────────────────────────

/**
 * Validate a team's answer for an ANSWER_QUESTION or SOLVE_PUZZLE step.
 *
 * Team-sync check: when `requireAllMembersOnline` is true (and wsHub is
 * provided), all team members must be connected via WebSocket.
 *
 * Comparison is case-insensitive and ignores leading/trailing whitespace.
 */
export async function submitAnswer(opts: {
  accountId: string;
  questRunId: string;
  stepId: string;
  answer: string;
  wsHub?: WsHub;
  /** Enforce team-sync: all members must be online. */
  requireAllMembersOnline?: boolean;
}): Promise<StepResult> {
  const { accountId, questRunId, stepId, answer, wsHub, requireAllMembersOnline } =
    opts;

  const { teamId, playerName } = await resolvePlayer(accountId);

  // Load QuestRun
  const [run] = await db
    .select()
    .from(questRuns)
    .where(
      and(
        eq(questRuns.id, questRunId),
        eq(questRuns.teamId, teamId),
        eq(questRuns.state, "ACTIVE"),
      ),
    );

  if (!run) {
    const err = new Error("QuestRun not found or not active.") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  // Load the target step
  const [step] = await db
    .select()
    .from(questSteps)
    .where(
      and(
        eq(questSteps.questDefinitionId, run.questDefinitionId),
        eq(questSteps.stepId, stepId),
        eq(questSteps.flowPhase, "OBJECTIVE"),
        inArray(questSteps.stepActionType, ["ANSWER_QUESTION", "SOLVE_PUZZLE"]),
      ),
    );

  if (!step) {
    const err = new Error(
      "Step not found or not an answer step.",
    ) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Check if already completed
  const [currentProgress] = await db
    .select()
    .from(objectiveProgress)
    .where(
      and(
        eq(objectiveProgress.questRunId, questRunId),
        eq(objectiveProgress.objectiveId, stepId),
      ),
    );

  if (currentProgress?.status === "COMPLETED") {
    return {
      stepId,
      status: "COMPLETED",
      message: "Dieser Schritt ist bereits abgeschlossen.",
    };
  }

  // Team-sync check: all members must be connected
  if (requireAllMembersOnline && wsHub) {
    const memberCountResult = await db
      .select({ count: count() })
      .from(players)
      .where(eq(players.teamId, teamId));

    const connected = wsHub.getRoomStats()[teamId] ?? 0;
    const total = Number(memberCountResult[0]?.count ?? 0);

    if (connected < total) {
      return {
        stepId,
        status: "FAILED",
        message: `Alle ${total} Teammitglieder müssen online sein. Verbunden: ${connected}/${total}.`,
      };
    }
  }

  // Look up the QuestStation for expected answer.
  // Strategy 1: via WorldObject lookup (targetRef matches world_object.external_id)
  // Strategy 2: for virtual "OBS-..." refs, extract the trailing sequence number
  //             and look up the station by (quest_definition_id, sequence).
  const targetObj = await lookupWorldObjectByTargetRef(step.targetRef);

  let station: { expectedAnswer: string | null } | undefined;

  if (targetObj) {
    [station] = await db
      .select({ expectedAnswer: questStations.expectedAnswer })
      .from(questStations)
      .where(
        and(
          eq(questStations.worldObjectId, targetObj.id),
          eq(questStations.questDefinitionId, run.questDefinitionId),
        ),
      );
  } else {
    // Virtual station ref (e.g. "OBS-D1-Q01-1"): parse trailing number as station sequence.
    const seqMatch = step.targetRef.match(/(\d+)$/);
    const seqGroup = seqMatch?.[1];
    if (seqGroup !== undefined) {
      const stationSeq = parseInt(seqGroup, 10);
      [station] = await db
        .select({ expectedAnswer: questStations.expectedAnswer })
        .from(questStations)
        .where(
          and(
            eq(questStations.questDefinitionId, run.questDefinitionId),
            eq(questStations.sequence, stationSeq),
          ),
        );
    }
  }

  if (!station) {
    const err = new Error("Target location not found.") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  if (!station?.expectedAnswer) {
    const err = new Error(
      "No expected answer configured for this station.",
    ) as Error & { statusCode: number };
    err.statusCode = 500;
    throw err;
  }

  // Case-insensitive, trimmed comparison
  const normalised = (s: string) => s.trim().toLowerCase();
  if (normalised(answer) !== normalised(station.expectedAnswer)) {
    return {
      stepId,
      status: "FAILED",
      message: "Falsche Antwort. Versucht es nochmal! 🤔",
    };
  }

  // Correct – mark completed & broadcast
  const { allRequiredDone } = await completeObjectiveStep({
    questRunId,
    stepId,
    stepActionType: step.stepActionType,
    run,
    playerName,
    ...(wsHub ? { wsHub } : {}),
  });

  return {
    stepId,
    status: "COMPLETED",
    message: "Richtige Antwort! ✓",
    questCompleted: allRequiredDone,
  };
}

// ── Public: completeQuest ─────────────────────────────────────────────────────

/**
 * Finalise a QuestRun after all required objectives are done.
 *
 * Typically triggered by a TALK_TO_NPC interaction at the end NPC location
 * (flow_phase: COMPLETE). Marks the run COMPLETED, books rewards (stub for
 * Epic 6), and broadcasts quest.completed to all team members.
 */
export async function completeQuest(opts: {
  accountId: string;
  questRunId: string;
  wsHub?: WsHub;
}): Promise<{ glory: number; denarii: number }> {
  const { accountId, questRunId, wsHub } = opts;

  const { teamId } = await resolvePlayer(accountId);

  // Load QuestRun
  const [run] = await db
    .select()
    .from(questRuns)
    .where(
      and(
        eq(questRuns.id, questRunId),
        eq(questRuns.teamId, teamId),
        eq(questRuns.state, "ACTIVE"),
      ),
    );

  if (!run) {
    const err = new Error("QuestRun not found or not active.") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  // Guard: all required objectives must be done
  const allSteps = await db
    .select({ step: questSteps, progress: objectiveProgress })
    .from(questSteps)
    .leftJoin(
      objectiveProgress,
      and(
        eq(objectiveProgress.questRunId, questRunId),
        eq(objectiveProgress.objectiveId, questSteps.stepId),
      ),
    )
    .where(
      and(
        eq(questSteps.questDefinitionId, run.questDefinitionId),
        eq(questSteps.flowPhase, "OBJECTIVE"),
        eq(questSteps.required, true),
      ),
    );

  const incomplete = allSteps.filter(
    (s) => !s.progress || s.progress.status !== "COMPLETED",
  );

  if (incomplete.length > 0) {
    const err = new Error(
      `${incomplete.length} required objective(s) not yet completed.`,
    ) as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  // Mark QuestRun as COMPLETED
  await db
    .update(questRuns)
    .set({ state: "COMPLETED", completedAt: new Date() })
    .where(eq(questRuns.id, questRunId));

  // Load quest title
  const [questDef] = await db
    .select({ title: questDefinitions.title })
    .from(questDefinitions)
    .where(eq(questDefinitions.id, run.questDefinitionId));

  // Default rewards – will be replaced by Epic 6 (Economy) Ledger booking
  const glory = 100;
  const denarii = 50;

  // TODO (Epic 6): await economyService.bookQuestRewards({ teamId, glory, denarii, questRunId });

  // Broadcast quest.completed to all team members
  if (wsHub) {
    const event: QuestCompletedEvent = {
      event: "quest.completed",
      teamId,
      questRunId,
      questTitle: questDef?.title ?? "Quest",
      rewardGlory: glory,
      rewardDenarii: denarii,
      timestamp: new Date().toISOString(),
    };
    wsHub.sendToTeam(teamId, event);
  }

  return { glory, denarii };
}

// ── Public: getSingleRun ──────────────────────────────────────────────────────

/**
 * Return one QuestRun by ID (team-scoped).
 */
export async function getSingleRun(
  questRunId: string,
  teamId: string,
): Promise<QuestRunDetail | null> {
  const rows = await db.execute<{
    id: string;
    team_id: string;
    quest_definition_id: string;
    state: string;
    started_at: Date;
    completed_at: Date | null;
    quest_title: string;
    quest_type: string;
    quest_day: string | null;
  }>(sql`
    SELECT qr.id,
           qr.team_id,
           qr.quest_definition_id,
           qr.state,
           qr.started_at,
           qr.completed_at,
           qd.title  AS quest_title,
           qd.type   AS quest_type,
           qd.day    AS quest_day
    FROM   quest_run        qr
    JOIN   quest_definition qd ON qd.id = qr.quest_definition_id
    WHERE  qr.id      = ${questRunId}
      AND  qr.team_id = ${teamId}
  `);

  const row = (rows.rows as (typeof rows.rows)[number][])[0] as {
    id: string;
    team_id: string;
    quest_definition_id: string;
    state: string;
    started_at: Date;
    completed_at: Date | null;
    quest_title: string;
    quest_type: string;
    quest_day: string | null;
  } | undefined;

  if (!row) return null;

  return buildQuestRunDetail({
    id: row.id,
    teamId: row.team_id,
    questDefinitionId: row.quest_definition_id,
    state: row.state as "ACTIVE" | "PENDING_REVIEW" | "COMPLETED" | "FAILED",
    startedAt: row.started_at,
    completedAt: row.completed_at,
    questTitle: row.quest_title,
    questType: row.quest_type,
    questDay: row.quest_day,
  });
}
