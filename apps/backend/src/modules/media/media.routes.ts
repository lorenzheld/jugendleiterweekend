import type { FastifyInstance } from "fastify";

export async function mediaRoutes(server: FastifyInstance): Promise<void> {
  /** POST /api/v1/media/upload-url – request pre-signed S3 upload URL */
  server.post("/upload-url", async (_request, reply) => {
    // TODO (Epic 8): generate pre-signed URL, create MediaSubmission (UPLOADING)
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** POST /api/v1/media/:id/review – GM submits review decision */
  server.post("/:id/review", async (_request, reply) => {
    // TODO (Epic 9): create ReviewDecision, update MediaSubmission, post LedgerEntry
    return reply.status(501).send({ message: "Not implemented yet" });
  });
}
