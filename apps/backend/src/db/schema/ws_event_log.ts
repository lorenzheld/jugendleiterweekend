/**
 * WebSocket Event Log Schema
 * ---------------------------
 * Persists WebSocket events for client reconnection recovery.
 * Events are retained for a limited window (e.g., 5 minutes) to support
 * clients recovering from temporary disconnections.
 */

import { pgTable, uuid, timestamp, text, jsonb, index } from "drizzle-orm/pg-core";

export const wsEventLog = pgTable(
  "ws_event_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    /** Event type (e.g., "radius.transition", "combat.round") */
    eventType: text("event_type").notNull(),
    
    /** Team this event belongs to */
    teamId: uuid("team_id").notNull(),
    
    /** Full event payload as JSON */
    payload: jsonb("payload").notNull(),
    
    /** Event timestamp (used for recovery queries) */
    timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Index for recovery queries: WHERE team_id = ? AND timestamp > ?
    teamTimestampIdx: index("ws_event_log_team_timestamp_idx")
      .on(table.teamId, table.timestamp),
  })
);
