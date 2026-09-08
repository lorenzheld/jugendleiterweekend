/**
 * Realtime Event Contracts (Epic 7)
 * ----------------------------------
 * WebSocket event schemas for team updates, PvP alerts, and system events.
 * 
 * These complement the existing event schemas:
 *   - geo.ts: RadiusEvent, WsConnectedEvent
 *   - combat.ts: CombatStartedEvent, CombatRoundResolvedEvent, CombatCompletedEvent
 *   - quest.ts: QuestAcceptedEvent, QuestStepCompletedEvent, QuestCompletedEvent
 */

import { z } from "zod";

// ── Team Events ───────────────────────────────────────────────────────────────

/**
 * Emitted when team state changes (fame, denarii, inventory, etc.)
 */
export const TeamUpdatedEventSchema = z.object({
  event: z.literal("team.updated"),
  teamId: z.string().uuid(),
  updates: z.object({
    fame: z.number().int().optional(),
    denarii: z.number().int().optional(),
    inventoryChanged: z.boolean().optional(),
  }),
  timestamp: z.string().datetime(),
});
export type TeamUpdatedEvent = z.infer<typeof TeamUpdatedEventSchema>;

/**
 * Emitted when a player joins the team (for multi-team scenarios)
 */
export const TeamMemberJoinedEventSchema = z.object({
  event: z.literal("team.member_joined"),
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  timestamp: z.string().datetime(),
});
export type TeamMemberJoinedEvent = z.infer<typeof TeamMemberJoinedEventSchema>;

/**
 * Emitted when a player leaves the team
 */
export const TeamMemberLeftEventSchema = z.object({
  event: z.literal("team.member_left"),
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  timestamp: z.string().datetime(),
});
export type TeamMemberLeftEvent = z.infer<typeof TeamMemberLeftEventSchema>;

// ── PvP Events ────────────────────────────────────────────────────────────────

/**
 * Emitted when a team challenges another team to PvP
 */
export const PvPChallengeEventSchema = z.object({
  event: z.literal("pvp.challenge"),
  sourceTeamId: z.string().uuid(),
  sourceTeamName: z.string(),
  targetTeamId: z.string().uuid(),
  targetTeamName: z.string(),
  challengeId: z.string().uuid(),
  timestamp: z.string().datetime(),
});
export type PvPChallengeEvent = z.infer<typeof PvPChallengeEventSchema>;

/**
 * Emitted when a PvP challenge is accepted
 */
export const PvPAcceptedEventSchema = z.object({
  event: z.literal("pvp.accepted"),
  sourceTeamId: z.string().uuid(),
  targetTeamId: z.string().uuid(),
  challengeId: z.string().uuid(),
  timestamp: z.string().datetime(),
});
export type PvPAcceptedEvent = z.infer<typeof PvPAcceptedEventSchema>;

/**
 * Emitted when a PvP challenge is declined
 */
export const PvPDeclinedEventSchema = z.object({
  event: z.literal("pvp.declined"),
  sourceTeamId: z.string().uuid(),
  targetTeamId: z.string().uuid(),
  challengeId: z.string().uuid(),
  timestamp: z.string().datetime(),
});
export type PvPDeclinedEvent = z.infer<typeof PvPDeclinedEventSchema>;

// ── System Events ─────────────────────────────────────────────────────────────

/**
 * Emitted for global announcements (GM messages, event updates)
 */
export const SystemAnnouncementEventSchema = z.object({
  event: z.literal("system.announcement"),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  timestamp: z.string().datetime(),
});
export type SystemAnnouncementEvent = z.infer<typeof SystemAnnouncementEventSchema>;

// ── Union Types ───────────────────────────────────────────────────────────────

/** Union of all team-related events */
export const TeamEventSchema = z.discriminatedUnion("event", [
  TeamUpdatedEventSchema,
  TeamMemberJoinedEventSchema,
  TeamMemberLeftEventSchema,
]);
export type TeamEvent = z.infer<typeof TeamEventSchema>;

/** Union of all PvP-related events */
export const PvPEventSchema = z.discriminatedUnion("event", [
  PvPChallengeEventSchema,
  PvPAcceptedEventSchema,
  PvPDeclinedEventSchema,
]);
export type PvPEvent = z.infer<typeof PvPEventSchema>;
