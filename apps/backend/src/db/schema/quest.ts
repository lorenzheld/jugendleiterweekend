import {
  pgTable,
  uuid,
  varchar,
  pgEnum,
  timestamp,
  integer,
  text,
} from "drizzle-orm/pg-core";
import { teams } from "./player.js";

export const questTypeEnum = pgEnum("quest_type", [
  "REGULAR",
  "HIDDEN",
  "LONG_TERM",
  "MEDIA",
]);

export const questRunStateEnum = pgEnum("quest_run_state", [
  "ACTIVE",
  "PENDING_REVIEW",
  "COMPLETED",
  "FAILED",
]);

export const questDefinitions = pgTable("quest_definition", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 128 }).notNull(),
  type: questTypeEnum("type").notNull(),
  contentJson: text("content_json").notNull().default("{}"),
});

export const questRuns = pgTable("quest_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  questDefinitionId: uuid("quest_definition_id")
    .notNull()
    .references(() => questDefinitions.id),
  state: questRunStateEnum("state").notNull().default("ACTIVE"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const objectiveProgress = pgTable("objective_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  questRunId: uuid("quest_run_id")
    .notNull()
    .references(() => questRuns.id, { onDelete: "cascade" }),
  objectiveId: varchar("objective_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  progressCount: integer("progress_count").notNull().default(0),
});
