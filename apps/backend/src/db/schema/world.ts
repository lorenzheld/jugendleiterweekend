import {
  pgTable,
  uuid,
  varchar,
  pgEnum,
  integer,
  doublePrecision,
  boolean,
  text,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────────────

/**
 * Runtime game-object type.
 * LOCATION  → physical place from GeoJSON location_candidate
 * ENEMY     → enemy encounter spawn from GeoJSON enemy_encounter
 * NPC       → non-player character anchor
 * STORE     → shop / market
 * BOSS      → boss encounter point
 * SAFE_ZONE → safe / rest area
 */
export const worldObjectTypeEnum = pgEnum("world_object_type", [
  "LOCATION",
  "ENEMY",
  "NPC",
  "STORE",
  "BOSS",
  "SAFE_ZONE",
]);

/**
 * Content lifecycle status (mirrors GeoJSON content_status values).
 * DRAFT                → initial authoring state
 * FIELD_CHECK_REQUIRED → coordinates/evidence need field verification
 * EDITORIAL_REVIEW     → content written; editorial sign-off pending
 * APPROVED             → cleared for production; publishable = true allowed
 */
export const contentStatusEnum = pgEnum("content_status", [
  "DRAFT",
  "FIELD_CHECK_REQUIRED",
  "EDITORIAL_REVIEW",
  "APPROVED",
]);

// ── WorldObject ────────────────────────────────────────────────────────────────

/**
 * Seeded from GeoJSON `location_candidate` and `enemy_encounter` features.
 * `external_id` is the authoritative natural key (the GeoJSON Feature.id field,
 * e.g. "location:place_day_1_acquedotto_vergine" or "enemy:UE-D1-01").
 *
 * Coordinates are stored as plain lat/lng for now; PostGIS geometry column
 * (geometry(Point, 4326)) will be added in Epic 3.
 */
export const worldObjects = pgTable("world_object", {
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Natural key from GeoJSON Feature.id, used for idempotent upsert.
   * E.g. "location:place_day_1_acquedotto_vergine", "enemy:UE-D1-01".
   */
  externalId: varchar("external_id", { length: 128 }).unique().notNull(),

  type: worldObjectTypeEnum("type").notNull(),

  /** Display name of the location / encounter. */
  name: varchar("name", { length: 256 }).notNull(),

  /** Which game day this object belongs to (e.g. "DAY_1", "DAY_2"). */
  day: varchar("day", { length: 16 }),

  /** Thematic cluster (e.g. "D1_TREVI_QUIRINALE"). */
  cluster: varchar("cluster", { length: 64 }),

  // ── Coordinates (WGS-84) ──────────────────────────────────────────────────
  /** Latitude in degrees. Nullable because some candidates lack geometry. */
  lat: doublePrecision("lat"),
  /** Longitude in degrees. Nullable because some candidates lack geometry. */
  lng: doublePrecision("lng"),

  // ── Geofence radii (in metres) ────────────────────────────────────────────
  /** Radius at which the map marker becomes visible. Default 55 m. */
  discoveryRadiusM: integer("discovery_radius_m").notNull().default(55),
  /** Radius for game interaction (tap / confirm). Default 15 m. */
  interactionRadiusM: integer("interaction_radius_m").notNull().default(15),
  /** Hysteresis radius to prevent flickering when leaving. Default 25 m. */
  exitHysteresisRadiusM: integer("exit_hysteresis_radius_m").notNull().default(25),
  /** Enemy-only: aggro radius. Default 20 m. */
  aggroRadiusM: integer("aggro_radius_m").notNull().default(20),

  // ── Content lifecycle ─────────────────────────────────────────────────────
  contentStatus: contentStatusEnum("content_status")
    .notNull()
    .default("DRAFT"),
  /** True only when contentStatus = APPROVED and explicitly cleared. */
  publishable: boolean("publishable").notNull().default(false),

  /** Raw GeoJSON properties stored for reference / future migrations. */
  rawPropertiesJson: text("raw_properties_json"),

  /** Incremented on each seed update to track content revisions. */
  contentVersion: integer("content_version").notNull().default(1),
});

// ── PlayArea ──────────────────────────────────────────────────────────────────

/**
 * Polygon boundaries for each game day (added in Epic 3 once PostGIS
 * Polygon column is confirmed; placeholder until then).
 */
export const playAreas = pgTable("play_area", {
  id: uuid("id").primaryKey().defaultRandom(),
  day: integer("day").notNull(),
  // Polygon stored as GeoJSON text until PostGIS extension is confirmed.
  geometryGeoJson: text("geometry_geo_json"),
});
