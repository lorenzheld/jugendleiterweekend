import {
  pgTable,
  uuid,
  pgEnum,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const worldObjectTypeEnum = pgEnum("world_object_type", [
  "NPC",
  "ENEMY",
  "STORE",
  "BOSS",
  "SAFE_ZONE",
]);

export const worldObjects = pgTable("world_object", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: worldObjectTypeEnum("type").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  /** Discovery radius in metres */
  discoveryRadius: integer("discovery_radius").notNull().default(50),
  /** Interaction radius in metres */
  interactionRadius: integer("interaction_radius").notNull().default(15),
  contentVersion: integer("content_version").notNull().default(1),
});

export const playAreas = pgTable("play_area", {
  id: uuid("id").primaryKey().defaultRandom(),
  day: integer("day").notNull(),
  // Polygon stored as GeoJSON text until PostGIS extension is confirmed
  geometryGeoJson: uuid("geometry_geo_json"),
});
