/**
 * Media Service – Epic 8 Media Quests
 * Handles photo/video uploads, review workflow, and ledger integration.
 */

import type { FastifyBaseLogger } from "fastify";
import { db } from "../../db/client.js";
import { mediaSubmissions, reviewDecisions } from "../../db/schema/media.js";
import { questRuns } from "../../db/schema/quest.js";
import { S3Service } from "./s3.service.js";
import { eq, and } from "drizzle-orm";
import type {
  PresignedUploadResponse,
  MediaSubmission,
  ReviewDecision,
} from "@jlw/contracts";

export class MediaService {
  private s3: S3Service;
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ module: "MediaService" });
    this.s3 = new S3Service(logger);
  }

  /**
   * Request a pre-signed S3 upload URL for a team's quest media submission.
   */
  async requestUploadUrl(
    teamId: string,
    questRunId: string,
    fileType: string,
    fileSizeBytes: number,
  ): Promise<PresignedUploadResponse> {
    // Validate that the QuestRun exists and belongs to this team
    const [questRun] = await db
      .select()
      .from(questRuns)
      .where(and(eq(questRuns.id, questRunId), eq(questRuns.teamId, teamId)))
      .limit(1);

    if (!questRun) {
      throw new Error("Quest run not found or does not belong to team");
    }

    if (questRun.state === "COMPLETED" || questRun.state === "FAILED") {
      throw new Error("Cannot upload media for completed or failed quest");
    }

    // Generate pre-signed URL
    const { uploadUrl, objectKey, expiresIn } = await this.s3.generatePresignedUploadUrl(
      teamId,
      questRunId,
      fileType,
      fileSizeBytes,
    );

    // Create MediaSubmission record (status: UPLOADING)
    const [submission] = await db
      .insert(mediaSubmissions)
      .values({
        teamId,
        questRunId,
        objectKey,
        status: "UPLOADING",
      })
      .returning();

    this.logger.info(
      { submissionId: submission!.id, teamId, questRunId },
      "Created media submission (UPLOADING)",
    );

    return { uploadUrl, objectKey, expiresIn };
  }

  /**
   * Confirm that an upload is complete (called by S3 webhook or client).
   * Transitions MediaSubmission → RECEIVED and QuestRun → PENDING_REVIEW.
   */
  async confirmUploadComplete(objectKey: string): Promise<MediaSubmission> {
    const [submission] = await db
      .select()
      .from(mediaSubmissions)
      .where(eq(mediaSubmissions.objectKey, objectKey))
      .limit(1);

    if (!submission) {
      throw new Error("Media submission not found for object key");
    }

    if (submission.status !== "UPLOADING") {
      this.logger.warn(
        { submissionId: submission.id, status: submission.status },
        "Upload already confirmed",
      );
      return {
        ...submission,
        submittedAt: submission.submittedAt.toISOString(),
      };
    }

    // Update submission → RECEIVED
    const [updated] = await db
      .update(mediaSubmissions)
      .set({ status: "RECEIVED" })
      .where(eq(mediaSubmissions.id, submission.id))
      .returning();

    // Update QuestRun → PENDING_REVIEW
    await db
      .update(questRuns)
      .set({ state: "PENDING_REVIEW" })
      .where(eq(questRuns.id, submission.questRunId));

    this.logger.info(
      { submissionId: submission.id, questRunId: submission.questRunId },
      "Upload confirmed → PENDING_REVIEW",
    );

    return {
      ...updated!,
      submittedAt: updated!.submittedAt.toISOString(),
    };
  }

  /**
   * Submit a GM review decision (Epic 9).
   * Approves/rejects the submission and posts LedgerEntry based on score.
   * Also marks the UPLOAD_MEDIA quest step as completed if approved.
   */
  async submitReview(
    submissionId: string,
    reviewerId: string,
    score: number,
    reason?: string,
  ): Promise<Omit<typeof reviewDecisions.$inferSelect, "decidedAt"> & { decidedAt: string }> {
    const [submission] = await db
      .select()
      .from(mediaSubmissions)
      .where(eq(mediaSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new Error("Media submission not found");
    }

    if (submission.status === "APPROVED" || submission.status === "REJECTED") {
      throw new Error("Submission already reviewed");
    }

    // Create ReviewDecision
    const [decision] = await db
      .insert(reviewDecisions)
      .values({
        submissionId,
        reviewerId,
        score,
        reason,
      })
      .returning();

    // Update MediaSubmission status
    const newStatus = score >= 5 ? "APPROVED" : "REJECTED";
    await db
      .update(mediaSubmissions)
      .set({ status: newStatus })
      .where(eq(mediaSubmissions.id, submissionId));

    // Update QuestRun state and mark UPLOAD_MEDIA step as completed
    if (newStatus === "APPROVED") {
      // Get the quest run to find the UPLOAD_MEDIA step
      const [questRun] = await db
        .select()
        .from(questRuns)
        .where(eq(questRuns.id, submission.questRunId))
        .limit(1);

      if (questRun) {
        // Find the UPLOAD_MEDIA step for this quest
        const { questSteps } = await import("../../db/schema/quest.js");
        const uploadSteps = await db
          .select()
          .from(questSteps)
          .where(
            and(
              eq(questSteps.questDefinitionId, questRun.questDefinitionId),
              eq(questSteps.stepActionType, "UPLOAD_MEDIA"),
            ),
          );

        // Mark all UPLOAD_MEDIA steps as completed (usually there's only one)
        const { objectiveProgress } = await import("../../db/schema/quest.js");
        for (const step of uploadSteps) {
          await db
            .insert(objectiveProgress)
            .values({
              questRunId: submission.questRunId,
              objectiveId: step.stepId,
              status: "COMPLETED",
              progressCount: 1,
            })
            .onConflictDoUpdate({
              target: [objectiveProgress.questRunId, objectiveProgress.objectiveId],
              set: {
                status: "COMPLETED",
                progressCount: 1,
              },
            });
        }

        // Check if all required objectives are now completed
        const allSteps = await db
          .select({ step: questSteps, progress: objectiveProgress })
          .from(questSteps)
          .leftJoin(
            objectiveProgress,
            and(
              eq(objectiveProgress.questRunId, submission.questRunId),
              eq(objectiveProgress.objectiveId, questSteps.stepId),
            ),
          )
          .where(
            and(
              eq(questSteps.questDefinitionId, questRun.questDefinitionId),
              eq(questSteps.flowPhase, "OBJECTIVE"),
              eq(questSteps.required, true),
            ),
          );

        const allRequiredDone = allSteps.every(
          (s) => s.progress?.status === "COMPLETED",
        );

        // Only complete the quest if all objectives are done
        if (allRequiredDone) {
          await db
            .update(questRuns)
            .set({ state: "COMPLETED", completedAt: new Date() })
            .where(eq(questRuns.id, submission.questRunId));
        } else {
          // Otherwise, transition from PENDING_REVIEW back to ACTIVE
          await db
            .update(questRuns)
            .set({ state: "ACTIVE" })
            .where(eq(questRuns.id, submission.questRunId));
        }
      }
    } else {
      // Rejected: set back to ACTIVE so team can re-upload
      await db
        .update(questRuns)
        .set({ state: "ACTIVE" })
        .where(eq(questRuns.id, submission.questRunId));
    }

    // Post LedgerEntry for Ruhm/Denare based on score (Epic 9)
    // Score 0-10: Award FAME and optionally DENARII
    const { appendLedgerEntry } = await import("../economy/ledger.service.js");
    const { v4: uuidv4 } = await import("uuid");
    
    if (newStatus === "APPROVED" && score > 0) {
      // Award FAME based on score (1-10 points)
      const fameAmount = score;
      await appendLedgerEntry({
        idempotencyKey: uuidv4(),
        teamId: submission.teamId,
        currencyType: "FAME",
        amount: fameAmount,
        source: "ADMIN",
      });

      // Award bonus DENARII for high scores (7-10 = 10-40 Denare)
      if (score >= 7) {
        const denariiAmount = (score - 6) * 10;
        await appendLedgerEntry({
          idempotencyKey: uuidv4(),
          teamId: submission.teamId,
          currencyType: "DENARII",
          amount: denariiAmount,
          source: "ADMIN",
        });
      }

      this.logger.info(
        { submissionId, teamId: submission.teamId, fameAmount, score },
        "Awarded media submission rewards",
      );
    }

    this.logger.info(
      { submissionId, reviewerId, score, status: newStatus },
      "Media review submitted",
    );

    const result = {
      ...decision!,
      decidedAt: decision!.decidedAt.toISOString(),
    };
    
    return decision!.reason ? { ...result, reason: decision!.reason } : result;
  }

  /**
   * Get all submissions for a team's quest run.
   */
  async getSubmissionsByQuestRun(questRunId: string): Promise<MediaSubmission[]> {
    const rows = await db
      .select()
      .from(mediaSubmissions)
      .where(eq(mediaSubmissions.questRunId, questRunId));
    
    return rows.map((r) => ({
      ...r,
      submittedAt: r.submittedAt.toISOString(),
    }));
  }

  /**
   * Get all pending submissions (for GM inbox, Epic 9).
   */
  async getPendingSubmissions(): Promise<MediaSubmission[]> {
    const rows = await db
      .select()
      .from(mediaSubmissions)
      .where(eq(mediaSubmissions.status, "RECEIVED"));
    
    return rows.map((r) => ({
      ...r,
      submittedAt: r.submittedAt.toISOString(),
    }));
  }
}
