import { z } from "zod";

// ── Location update (player → server) ────────────────────────────────────────

/** Body sent by the player client when the Geolocation API fires. */
export const UpdateLocationRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** GPS horizontal accuracy in metres (from GeolocationCoordinates.accuracy). */
  accuracy: z.number().positive().max(500),
  /** Optional: opaque device fingerprint for session correlation. */
  deviceId: z.string().max(128).optional(),
});
export type UpdateLocationRequest = z.infer<typeof UpdateLocationRequestSchema>;

/** Server response after persisting the player's location. */
export const UpdateLocationResponseSchema = z.object({
  playerId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
  updatedAt: z.string().datetime(),
});
export type UpdateLocationResponse = z.infer<
  typeof UpdateLocationResponseSchema
>;

// ── Interaction distance check ────────────────────────────────────────────────

/**
 * Used internally (and optionally exposed) to validate whether a player
 * is within the interaction radius of a world object.
 *
 * effectiveDistance = max(0, haversineMetres - accuracy)
 *
 * This gives the player the benefit of the doubt when GPS is imprecise.
 */
export const DistanceCheckSchema = z.object({
  /** Actual distance between the two points in metres. */
  actualDistanceM: z.number().nonnegative(),
  /** Accuracy-adjusted distance used for radius validation. */
  effectiveDistanceM: z.number().nonnegative(),
  /** Whether effectiveDistanceM ≤ targetRadiusM. */
  withinRange: z.boolean(),
});
export type DistanceCheck = z.infer<typeof DistanceCheckSchema>;
