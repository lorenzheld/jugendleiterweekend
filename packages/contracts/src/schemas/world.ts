import { z } from "zod";

export const WorldObjectTypeSchema = z.enum([
  "LOCATION",
  "ENEMY",
  "NPC",
  "STORE",
  "BOSS",
  "SAFE_ZONE",
]);
export type WorldObjectType = z.infer<typeof WorldObjectTypeSchema>;

export const WorldObjectSchema = z.object({
  id: z.string().uuid(),
  type: WorldObjectTypeSchema,
  lat: z.number(),
  lng: z.number(),
  discoveryRadius: z.number().positive(),
  interactionRadius: z.number().positive(),
  contentVersion: z.number().int(),
});
export type WorldObject = z.infer<typeof WorldObjectSchema>;
