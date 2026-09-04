import type { FastifyInstance } from "fastify";

export async function economyRoutes(server: FastifyInstance): Promise<void> {
  /** GET /api/v1/economy/ledger – ledger entries for team */
  server.get("/ledger", async (_request, reply) => {
    // TODO (Epic 4): fetch LedgerEntries for authenticated team
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** POST /api/v1/economy/trade – atomic team-to-team trade */
  server.post("/trade", async (_request, reply) => {
    // TODO (Epic 4): atomic trade transaction with idempotency key
    return reply.status(501).send({ message: "Not implemented yet" });
  });
}
