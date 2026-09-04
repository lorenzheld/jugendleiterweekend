import {
  pgTable,
  uuid,
  pgEnum,
  integer,
  timestamp,
  text,
  jsonb,
  varchar,
} from "drizzle-orm/pg-core";
import { teams } from "./player.js";
import { questRuns } from "./quest.js";
import { accounts } from "./account.js";

export const mediaStatusEnum = pgEnum("media_status", [
  "UPLOADING",
  "RECEIVED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export const mediaSubmissions = pgTable("media_submission", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  questRunId: uuid("quest_run_id")
    .notNull()
    .references(() => questRuns.id),
  objectKey: text("object_key").notNull(),
  status: mediaStatusEnum("status").notNull().default("UPLOADING"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reviewDecisions = pgTable("review_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => mediaSubmissions.id),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => accounts.id),
  score: integer("score").notNull(),
  reason: text("reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditEvents = pgTable("audit_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => accounts.id),
  action: varchar("action", { length: 64 }).notNull(),
  targetRefs: text("target_refs"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
