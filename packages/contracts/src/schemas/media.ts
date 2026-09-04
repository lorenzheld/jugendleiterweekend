import { z } from "zod";

export const MediaStatusSchema = z.enum([
  "UPLOADING",
  "RECEIVED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
]);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

export const MediaSubmissionSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  questRunId: z.string().uuid(),
  objectKey: z.string(),
  status: MediaStatusSchema,
  submittedAt: z.string().datetime(),
});
export type MediaSubmission = z.infer<typeof MediaSubmissionSchema>;

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  expiresIn: z.number().int(),
});
export type PresignedUploadResponse = z.infer<
  typeof PresignedUploadResponseSchema
>;
