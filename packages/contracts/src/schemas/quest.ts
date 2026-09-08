/**
 * Quest Contracts – shared Zod schemas for Epic 4 Quest Engine.
 *
 * Covers:
 *   • Enums: FlowPhase, StepActionType, QuestType, QuestRunState
 *   • DB-shaped types: QuestStep, QuestStation, ObjectiveProgress, QuestRun
 *   • API response types: QuestRunDetail, QuestAvailable
 *   • Request bodies: AcceptQuestBody, SubmitAnswerBody
 *   • WebSocket events: QuestAcceptedEvent, QuestStepCompletedEvent, QuestCompletedEvent
 */

import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const QuestTypeSchema = z.enum([
  "REGULAR",
  "HIDDEN",
  "LONG_TERM",
  "MEDIA",
]);
export type QuestType = z.infer<typeof QuestTypeSchema>;

export const QuestRunStateSchema = z.enum([
  "ACTIVE",
  "PENDING_REVIEW",
  "COMPLETED",
  "FAILED",
]);
export type QuestRunState = z.infer<typeof QuestRunStateSchema>;

/**
 * Flow phases from GeoJSON `quest_step_refs.flow_phase`.
 * Maps directly to the `flow_phase` DB enum.
 */
export const FlowPhaseSchema = z.enum([
  "DISCOVER",
  "DIALOGUE",
  "ACCEPT",
  "OBJECTIVE",
  "BONUS_OBJECTIVE",
  "COMPLETE",
]);
export type FlowPhase = z.infer<typeof FlowPhaseSchema>;

/** Concrete action the player must perform. Maps to `step_action_type` DB enum. */
export const StepActionTypeSchema = z.enum([
  "REACH_LOCATION",
  "ANSWER_QUESTION",
  "SOLVE_PUZZLE",
  "DEFEAT_ENEMY",
  "DISCOVER_NPC",
  "TALK_TO_NPC",
  "ACCEPT_QUEST",
  "UPLOAD_MEDIA",
  "USE_ITEM",
  "CLASS_ACTION",
  "TEAM_DECISION",
  "OTHER",
]);
export type StepActionType = z.infer<typeof StepActionTypeSchema>;

// ── Core entity schemas ───────────────────────────────────────────────────────

/** A single step within a QuestDefinition (seeded from GeoJSON). */
export const QuestStepSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string(),
  sequence: z.number().int(),
  flowPhase: FlowPhaseSchema,
  stepActionType: StepActionTypeSchema,
  stepCategory: z.string(),
  gddObjectiveType: z.string().nullable(),
  targetRef: z.string(),
  required: z.boolean(),
  /**
   * Human-readable name of the target WorldObject (only present for
   * REACH_LOCATION steps where a physical location must be visited).
   */
  targetObjectName: z.string().nullable().optional(),
  /** Latitude of the target WorldObject (REACH_LOCATION steps only). */
  targetLat: z.number().nullable().optional(),
  /** Longitude of the target WorldObject (REACH_LOCATION steps only). */
  targetLng: z.number().nullable().optional(),
});
export type QuestStep = z.infer<typeof QuestStepSchema>;

/** Progress tracking for a single OBJECTIVE step within a QuestRun. */
export const ObjectiveProgressSchema = z.object({
  /** Matches QuestStep.stepId */
  objectiveId: z.string(),
  status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]),
  progressCount: z.number().int(),
});
export type ObjectiveProgress = z.infer<typeof ObjectiveProgressSchema>;

/** A QuestRun record (flat, no joins). */
export const QuestRunSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  questDefinitionId: z.string().uuid(),
  state: QuestRunStateSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
});
export type QuestRun = z.infer<typeof QuestRunSchema>;

/**
 * A QuestRun enriched with definition metadata and per-step progress.
 * Returned by GET /api/v1/quests and POST /api/v1/quests/:id/accept.
 */
export const QuestRunDetailSchema = QuestRunSchema.extend({
  questTitle: z.string(),
  questType: QuestTypeSchema,
  questDay: z.string().nullable(),
  /**
   * The step the team should work on right now.
   * Null when all required objectives are completed (COMPLETE phase pending).
   */
  currentStep: QuestStepSchema.nullable(),
  /** All OBJECTIVE steps with their current progress. */
  objectives: z.array(
    QuestStepSchema.extend({
      progress: ObjectiveProgressSchema.nullable(),
    }),
  ),
});
export type QuestRunDetail = z.infer<typeof QuestRunDetailSchema>;

/**
 * A QuestDefinition the team can see but has not yet accepted.
 * Phase is derived from the proximity zone of the trigger WorldObject.
 */
export const QuestAvailableSchema = z.object({
  questDefinitionId: z.string().uuid(),
  externalId: z.string(),
  title: z.string(),
  type: QuestTypeSchema,
  day: z.string().nullable(),
  /**
   * DISCOVER  → within discovery_radius_m; marker visible, no interaction yet.
   * DIALOGUE  → within interaction_radius_m; conversation UI should open.
   */
  discoveryPhase: z.enum(["DISCOVER", "DIALOGUE"]),
  /** The WorldObject UUID that triggered discovery of this quest. */
  triggerObjectId: z.string().uuid(),
  triggerObjectName: z.string(),
});
export type QuestAvailable = z.infer<typeof QuestAvailableSchema>;

// ── API Request / Response schemas ────────────────────────────────────────────

export const AcceptQuestBodySchema = z.object({
  questDefinitionId: z.string().uuid(),
});
export type AcceptQuestBody = z.infer<typeof AcceptQuestBodySchema>;

export const SubmitAnswerBodySchema = z.object({
  answer: z.string().min(1).max(512).trim(),
});
export type SubmitAnswerBody = z.infer<typeof SubmitAnswerBodySchema>;

export const ActiveQuestsResponseSchema = z.object({
  runs: z.array(QuestRunDetailSchema),
});
export type ActiveQuestsResponse = z.infer<typeof ActiveQuestsResponseSchema>;

export const AvailableQuestsResponseSchema = z.object({
  quests: z.array(QuestAvailableSchema),
});
export type AvailableQuestsResponse = z.infer<
  typeof AvailableQuestsResponseSchema
>;

/** Returned by step-completion endpoints (reach, answer, complete). */
export const StepResultSchema = z.object({
  stepId: z.string(),
  status: z.enum(["COMPLETED", "FAILED"]),
  /** Human-readable feedback for the player. */
  message: z.string(),
  /** True when this step completed the last required objective. */
  questCompleted: z.boolean().optional(),
  /** Populated when questCompleted is true. */
  rewards: z
    .object({ glory: z.number().int(), denarii: z.number().int() })
    .optional(),
});
export type StepResult = z.infer<typeof StepResultSchema>;

export const CompleteQuestResponseSchema = z.object({
  questRunId: z.string().uuid(),
  glory: z.number().int(),
  denarii: z.number().int(),
  items: z
    .array(
      z.object({
        defKey: z.string(),
        quantity: z.number().int(),
        owner: z.enum(["PLAYER", "TEAM"]),
      }),
    )
    .optional()
    .default([]),
  itemsSkipped: z.boolean().optional(),
});
export type CompleteQuestResponse = z.infer<typeof CompleteQuestResponseSchema>;

// ── WebSocket Quest Events ────────────────────────────────────────────────────

/**
 * Broadcast to all team members when a player accepts a quest.
 * Triggers a quest list refetch on all clients.
 */
export const QuestAcceptedEventSchema = z.object({
  event: z.literal("quest.accepted"),
  teamId: z.string().uuid(),
  questRunId: z.string().uuid(),
  questTitle: z.string(),
  acceptedByPlayerName: z.string(),
  timestamp: z.string().datetime(),
});
export type QuestAcceptedEvent = z.infer<typeof QuestAcceptedEventSchema>;

/**
 * Broadcast when a team completes an OBJECTIVE step.
 * All clients show a "step done" toast and advance their local UI state.
 */
export const QuestStepCompletedEventSchema = z.object({
  event: z.literal("quest.step_completed"),
  teamId: z.string().uuid(),
  questRunId: z.string().uuid(),
  questTitle: z.string(),
  stepId: z.string(),
  stepActionType: StepActionTypeSchema,
  completedByPlayerName: z.string(),
  /** The next step to work on, or null if all done. */
  nextStep: QuestStepSchema.nullable(),
  timestamp: z.string().datetime(),
});
export type QuestStepCompletedEvent = z.infer<
  typeof QuestStepCompletedEventSchema
>;

/**
 * Broadcast when a QuestRun reaches COMPLETED state.
 * All clients show the reward screen.
 */
export const QuestCompletedEventSchema = z.object({
  event: z.literal("quest.completed"),
  teamId: z.string().uuid(),
  questRunId: z.string().uuid(),
  questTitle: z.string(),
  rewardGlory: z.number().int(),
  rewardDenarii: z.number().int(),
  timestamp: z.string().datetime(),
});
export type QuestCompletedEvent = z.infer<typeof QuestCompletedEventSchema>;

/** Union of all quest-related WS events (discriminated by `event` field). */
export const QuestEventSchema = z.discriminatedUnion("event", [
  QuestAcceptedEventSchema,
  QuestStepCompletedEventSchema,
  QuestCompletedEventSchema,
]);
export type QuestEvent = z.infer<typeof QuestEventSchema>;
