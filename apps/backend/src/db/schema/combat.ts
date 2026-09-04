import {
  pgTable,
  uuid,
  pgEnum,
  integer,
  timestamp,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { teams } from "./player.js";

export const combatTypeEnum = pgEnum("combat_type", ["PVE", "PVP", "BOSS"]);
export const combatStateEnum = pgEnum("combat_state", [
  "AWAITING_ACTIONS",
  "LOCKED",
  "RESOLVING",
  "COMPLETED",
]);
export const entityTypeEnum = pgEnum("entity_type", ["PLAYER", "ENEMY"]);
export const actionTypeEnum = pgEnum("action_type", [
  "ATTACK",
  "DEFEND",
  "SKILL",
  "FLEE",
]);
export const pvpChallengeStateEnum = pgEnum("pvp_challenge_state", [
  "WARNING",
  "ESCAPED",
  "COMBAT",
]);

export const combatInstances = pgTable("combat_instance", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: combatTypeEnum("type").notNull(),
  state: combatStateEnum("state").notNull().default("AWAITING_ACTIONS"),
  roundNumber: integer("round_number").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const combatants = pgTable("combatant", {
  id: uuid("id").primaryKey().defaultRandom(),
  combatInstanceId: uuid("combat_instance_id")
    .notNull()
    .references(() => combatInstances.id, { onDelete: "cascade" }),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  teamId: uuid("team_id").references(() => teams.id),
  hpCurrent: integer("hp_current").notNull(),
});

export const combatActions = pgTable("combat_action", {
  id: uuid("id").primaryKey().defaultRandom(),
  combatInstanceId: uuid("combat_instance_id")
    .notNull()
    .references(() => combatInstances.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  actorId: uuid("actor_id").notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  targetId: uuid("target_id"),
  isLocked: boolean("is_locked").notNull().default(false),
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
});

export const pvpChallenges = pgTable("pvp_challenge", {
  id: uuid("id").primaryKey().defaultRandom(),
  attackerTeamId: uuid("attacker_team_id")
    .notNull()
    .references(() => teams.id),
  defenderTeamId: uuid("defender_team_id")
    .notNull()
    .references(() => teams.id),
  state: pvpChallengeStateEnum("state").notNull().default("WARNING"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
