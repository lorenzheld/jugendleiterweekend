/**
 * Zod schemas for the Via Romae GeoJSON (schema version v0.8).
 *
 * Coverage:
 *   • location_candidate   (90 features)
 *   • quest_definition     (40 features)
 *   • enemy_encounter      (12 features)
 *   • quest_timer          ( 6 features)
 *   • navigation_challenge ( 4 features)
 *
 * Design decisions:
 *   • `.passthrough()` on all property schemas so that additional GeoJSON
 *     fields are preserved without causing validation failures.
 *   • Geometry is nullable: 17 location_candidates have no geometry.
 *   • `content_status` is a plain string; allowed values are validated only
 *     in the seed filter, not here, to remain forward-compatible.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Primitive geometry schemas
// ─────────────────────────────────────────────────────────────────────────────

/** WGS-84 coordinate pair: [longitude, latitude] */
const CoordinateSchema = z.tuple([z.number(), z.number()]);

export const PointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: CoordinateSchema,
});

export const MultiPointGeometrySchema = z.object({
  type: z.literal("MultiPoint"),
  coordinates: z.array(CoordinateSchema).min(1),
});

/**
 * Any geometry type that appears in the Via Romae GeoJSON.
 * Can be null for features without confirmed coordinates.
 */
export const AnyGameGeometrySchema = z
  .union([PointGeometrySchema, MultiPointGeometrySchema])
  .nullable();

export type PointGeometry = z.infer<typeof PointGeometrySchema>;
export type MultiPointGeometry = z.infer<typeof MultiPointGeometrySchema>;
export type AnyGameGeometry = z.infer<typeof AnyGameGeometrySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Geofence block included on some location_candidate features.
 * When absent, values fall back to implementation_defaults in the metadata.
 */
export const GeofenceSchema = z.object({
  interaction_radius_m: z.number().int().positive(),
  exit_hysteresis_radius_m: z.number().int().positive(),
  discovery_radius_m: z.number().int().positive(),
});
export type Geofence = z.infer<typeof GeofenceSchema>;

/**
 * A single quest step reference embedded inside a location_candidate.
 * Corresponds to the `quest_step_refs` array in the GeoJSON properties.
 */
export const QuestStepRefSchema = z
  .object({
    quest_id: z.string().min(1),
    step_id: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    flow_phase: z.string().min(1),
    step_action_type: z.string().min(1),
    step_category: z.string().min(1),
    gdd_objective_type: z.string().nullable(),
    target_ref: z.string().min(1),
    required: z.boolean(),
  })
  .passthrough();
export type QuestStepRef = z.infer<typeof QuestStepRefSchema>;

/**
 * A quest station entry embedded inside a location_candidate.
 * Corresponds to the `quest_stations` array in the GeoJSON properties.
 */
export const QuestStationRefSchema = z
  .object({
    quest_id: z.string().min(1),
    quest_type: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    role: z.string().min(1),
    observable_evidence: z.string(),
    location_question: z.string().nullable().optional(),
    expected_answer: z.string().nullable().optional(),
    access_fallback_note: z.string().nullable().optional(),
    enemy_hook: z.string().nullable().optional(),
  })
  .passthrough();
export type QuestStationRef = z.infer<typeof QuestStationRefSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// location_candidate
// ─────────────────────────────────────────────────────────────────────────────

export const LocationCandidatePropertiesSchema = z
  .object({
    feature_type: z.literal("location_candidate"),
    candidate_id: z.string().min(1),
    name: z.string().min(1),
    day: z.string().min(1),
    cluster: z.string().optional(),
    content_status: z.string().min(1),
    publishable: z.boolean(),
    quest_stations: z.array(QuestStationRefSchema).default([]),
    quest_step_refs: z.array(QuestStepRefSchema).default([]),
    /** Present on most features; absent on a handful without confirmed coords. */
    geofence: GeofenceSchema.optional(),
  })
  .passthrough();
export type LocationCandidateProperties = z.infer<
  typeof LocationCandidatePropertiesSchema
>;

export const LocationCandidateFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().startsWith("location:"),
  geometry: AnyGameGeometrySchema,
  properties: LocationCandidatePropertiesSchema,
});
export type LocationCandidateFeature = z.infer<
  typeof LocationCandidateFeatureSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// quest_definition
// ─────────────────────────────────────────────────────────────────────────────

export const QuestDefinitionPropertiesSchema = z
  .object({
    feature_type: z.literal("quest_definition"),
    quest_id: z.string().min(1),
    quest_type: z.string().min(1),
    day: z.string().min(1),
    title: z.string().min(1),
    content_status: z.string().min(1),
    publishable: z.boolean(),
    /** Default 15; matches implementation_defaults.location_interaction_radius_m. */
    standard_interaction_radius_m: z.number().int().positive().optional().default(15),
    ordered_candidate_ids: z.array(z.string()).optional().default([]),
    timer_refs: z.array(z.string()).optional().default([]),
    has_timer_stage: z.boolean().optional().default(false),
  })
  .passthrough();
export type QuestDefinitionProperties = z.infer<
  typeof QuestDefinitionPropertiesSchema
>;

export const QuestDefinitionFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().startsWith("quest:"),
  geometry: AnyGameGeometrySchema,
  properties: QuestDefinitionPropertiesSchema,
});
export type QuestDefinitionFeature = z.infer<typeof QuestDefinitionFeatureSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// enemy_encounter
// ─────────────────────────────────────────────────────────────────────────────

export const EnemyEncounterPropertiesSchema = z
  .object({
    feature_type: z.literal("enemy_encounter"),
    encounter_id: z.string().min(1),
    candidate_id: z.string().optional(),
    name: z.string().min(1),
    day: z.string().min(1),
    cluster: z.string().optional(),
    content_status: z.string().min(1),
    publishable: z.boolean(),
    /** Aggro trigger radius in metres. Default 20 m. */
    aggro_radius_m: z.number().int().positive().optional().default(20),
    respawn_scope: z.string().optional(),
  })
  .passthrough();
export type EnemyEncounterProperties = z.infer<
  typeof EnemyEncounterPropertiesSchema
>;

export const EnemyEncounterFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().startsWith("enemy:"),
  geometry: AnyGameGeometrySchema,
  properties: EnemyEncounterPropertiesSchema,
});
export type EnemyEncounterFeature = z.infer<typeof EnemyEncounterFeatureSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// quest_timer
// ─────────────────────────────────────────────────────────────────────────────

export const QuestTimerPropertiesSchema = z
  .object({
    feature_type: z.literal("quest_timer"),
    timer_id: z.string().min(1),
    quest_id: z.string().min(1),
    step_id: z.string().min(1),
    title: z.string().min(1),
    timer_scope: z.string().min(1),
    duration_sec: z.number().int().positive(),
    content_status: z.string().min(1),
    publishable: z.boolean(),
  })
  .passthrough();
export type QuestTimerProperties = z.infer<typeof QuestTimerPropertiesSchema>;

export const QuestTimerFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().startsWith("timer:"),
  geometry: AnyGameGeometrySchema,
  properties: QuestTimerPropertiesSchema,
});
export type QuestTimerFeature = z.infer<typeof QuestTimerFeatureSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// navigation_challenge
// ─────────────────────────────────────────────────────────────────────────────

export const NavigationChallengePropertiesSchema = z
  .object({
    feature_type: z.literal("navigation_challenge"),
    navigation_id: z.string().min(1),
    quest_id: z.string().min(1),
    segment: z.string().optional(),
    mode: z.string().optional(),
    publishable: z.boolean(),
    blocks_release_until_field_test: z.boolean().optional().default(false),
    /** content_status is absent on some navigation_challenge features. */
    content_status: z.string().optional(),
  })
  .passthrough();
export type NavigationChallengeProperties = z.infer<
  typeof NavigationChallengePropertiesSchema
>;

export const NavigationChallengeFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().startsWith("navigation:"),
  geometry: AnyGameGeometrySchema,
  properties: NavigationChallengePropertiesSchema,
});
export type NavigationChallengeFeature = z.infer<
  typeof NavigationChallengeFeatureSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// GeoJSON metadata block (top-level `metadata` property)
// ─────────────────────────────────────────────────────────────────────────────

export const ImplementationDefaultsSchema = z.object({
  location_interaction_radius_m: z.number().int().positive(),
  interaction_exit_hysteresis_radius_m: z.number().int().positive(),
  discovery_radius_m: z.number().int().positive(),
  enemy_aggro_radius_m: z.number().int().positive(),
  boss_join_radius_m: z.number().int().positive(),
  normal_location_required_team_members: z.number().int().positive(),
});
export type ImplementationDefaults = z.infer<typeof ImplementationDefaultsSchema>;

export const GeoJsonMetadataSchema = z.object({
  schema: z.string(),
  generated_at_utc: z.string(),
  implementation_defaults: ImplementationDefaultsSchema,
  feature_counts: z.record(z.string(), z.number()).optional(),
  release_rule: z.string().optional(),
}).passthrough();
export type GeoJsonMetadata = z.infer<typeof GeoJsonMetadataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Union of all feature types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all known Via Romae GeoJSON feature types.
 * Prefer using `RawFeatureSchema` + `GameFeatureParsers[featureType]` in the
 * seed script for better error isolation per feature.
 */
export const AnyGameFeatureSchema = z.union([
  LocationCandidateFeatureSchema,
  QuestDefinitionFeatureSchema,
  EnemyEncounterFeatureSchema,
  QuestTimerFeatureSchema,
  NavigationChallengeFeatureSchema,
]);

/**
 * Individual feature type parsers (preferred over AnyGameFeatureSchema when
 * you already know the feature_type from `properties.feature_type`).
 */
export const GameFeatureParsers = {
  location_candidate: LocationCandidateFeatureSchema,
  quest_definition: QuestDefinitionFeatureSchema,
  enemy_encounter: EnemyEncounterFeatureSchema,
  quest_timer: QuestTimerFeatureSchema,
  navigation_challenge: NavigationChallengeFeatureSchema,
} as const;

export type GameFeatureType = keyof typeof GameFeatureParsers;

// ─────────────────────────────────────────────────────────────────────────────
// Top-level FeatureCollection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The raw feature before type-specific parsing.
 * Used in the seed script to safely read `properties.feature_type`
 * before dispatching to the correct schema.
 */
export const RawFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: AnyGameGeometrySchema,
  properties: z.object({ feature_type: z.string() }).passthrough(),
});
export type RawFeature = z.infer<typeof RawFeatureSchema>;

export const GameFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  metadata: GeoJsonMetadataSchema,
  features: z.array(z.unknown()),
});
export type GameFeatureCollection = z.infer<typeof GameFeatureCollectionSchema>;
