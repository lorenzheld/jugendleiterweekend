import { z } from "zod";

export const QuestTypeSchema = z.enum([
  "REGULAR",
  "HIDDEN",
  "LONG_TERM",
  "MEDIA",
]);
export type QuestType = z.infer<typeof QuestTypeSchema>;

export const QuestRunStateSchema = z.enum([
  "ACTIVE",
  "PENDING_REVIEW",
  "COMPLETED",
  "FAILED",
]);
export type QuestRunState = z.infer<typeof QuestRunStateSchema>;

export const QuestRunSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  questDefinitionId: z.string().uuid(),
  state: QuestRunStateSchema,
  startedAt: z.string().datetime(),
});
export type QuestRun = z.infer<typeof QuestRunSchema>;
