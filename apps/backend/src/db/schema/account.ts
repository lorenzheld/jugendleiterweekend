import {
  pgTable,
  uuid,
  varchar,
  pgEnum,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["PLAYER", "GM", "ADMIN"]);

export const accounts = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  accessCodeHash: text("access_code_hash").notNull(),
  role: roleEnum("role").notNull().default("PLAYER"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  deviceId: varchar("device_id", { length: 128 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
