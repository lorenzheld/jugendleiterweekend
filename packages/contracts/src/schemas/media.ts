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

// ── Request/Response Schemas ──────────────────────────────────────────────────

export const RequestUploadUrlBodySchema = z.object({
  questRunId: z.string().uuid(),
  fileType: z.enum(["image/jpeg", "image/png", "video/mp4", "video/quicktime"]),
  fileSizeBytes: z.number().int().positive().max(50 * 1024 * 1024), // 50 MB max
});
export type RequestUploadUrlBody = z.infer<typeof RequestUploadUrlBodySchema>;

export const SubmitReviewBodySchema = z.object({
  score: z.number().int().min(0).max(10),
  reason: z.string().optional(),
});
export type SubmitReviewBody = z.infer<typeof SubmitReviewBodySchema>;

export const ReviewDecisionSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  score: z.number(),
  reason: z.string().optional(),
  decidedAt: z.string().datetime(),
});
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

// ── WebSocket Events ──────────────────────────────────────────────────────────

export const MediaUploadCompletedEventSchema = z.object({
  event: z.literal("media:upload_completed"),
  data: z.object({
    submissionId: z.string().uuid(),
    questRunId: z.string().uuid(),
  }),
});
export type MediaUploadCompletedEvent = z.infer<typeof MediaUploadCompletedEventSchema>;

export const MediaReviewedEventSchema = z.object({
  event: z.literal("media:reviewed"),
  data: z.object({
    submissionId: z.string().uuid(),
    questRunId: z.string().uuid(),
    status: MediaStatusSchema,
    score: z.number(),
  }),
});
export type MediaReviewedEvent = z.infer<typeof MediaReviewedEventSchema>;
