import type { FastifyInstance } from "fastify";

export async function questRoutes(server: FastifyInstance): Promise<void> {
  /** GET /api/v1/quests – active quest runs for team */
  server.get("/", async (_request, reply) => {
    // TODO (Epic 3): fetch QuestRuns for authenticated team
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** POST /api/v1/quests/:id/accept – accept a quest (slot-check ≤3) */
  server.post("/:id/accept", async (_request, reply) => {
    // TODO (Epic 3): state-machine ACTIVE, enforce max 3 active quests
    return reply.status(501).send({ message: "Not implemented yet" });
  });
}
