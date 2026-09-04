import { z } from "zod";

export const CombatTypeSchema = z.enum(["PVE", "PVP", "BOSS"]);
export type CombatType = z.infer<typeof CombatTypeSchema>;

export const CombatStateSchema = z.enum([
  "AWAITING_ACTIONS",
  "LOCKED",
  "RESOLVING",
  "COMPLETED",
]);
export type CombatState = z.infer<typeof CombatStateSchema>;

export const CombatActionTypeSchema = z.enum([
  "ATTACK",
  "DEFEND",
  "SKILL",
  "FLEE",
]);
export type CombatActionType = z.infer<typeof CombatActionTypeSchema>;

export const SubmitActionRequestSchema = z.object({
  combatInstanceId: z.string().uuid(),
  roundNumber: z.number().int().nonnegative(),
  actionType: CombatActionTypeSchema,
  targetId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
});
export type SubmitActionRequest = z.infer<typeof SubmitActionRequestSchema>;

export const CombatInstanceSchema = z.object({
  id: z.string().uuid(),
  type: CombatTypeSchema,
  state: CombatStateSchema,
  roundNumber: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
});
export type CombatInstance = z.infer<typeof CombatInstanceSchema>;
