import {
  pgTable,
  uuid,
  varchar,
  integer,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { accounts } from "./account.js";

export const playerClassEnum = pgEnum("player_class", [
  "GARDIST",
  "MÖNCH",
  "HÄNDLER",
  "SPÄHER",
  "MAGIER",
]);

export const playerStatusEnum = pgEnum("player_status", ["ACTIVE", "DOWNED"]);

export const teams = pgTable("team", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  inventoryCapacity: integer("inventory_capacity").notNull().default(40),
});

export const players = pgTable("player", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  class: playerClassEnum("class").notNull(),
  hpCurrent: integer("hp_current").notNull().default(100),
  status: playerStatusEnum("status").notNull().default("ACTIVE"),
  // PostGIS point stored as raw lat/lng for initial Epic 2; migrate to geometry later.
  lastLat: doublePrecision("last_lat"),
  lastLng: doublePrecision("last_lng"),
});
