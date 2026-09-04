import type { FastifyInstance } from "fastify";

export async function combatRoutes(server: FastifyInstance): Promise<void> {
  /** GET /api/v1/combat/:id – get combat instance state */
  server.get("/:id", async (_request, reply) => {
    // TODO (Epic 5): return CombatInstance snapshot
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** POST /api/v1/combat/:id/action – submit round action */
  server.post("/:id/action", async (_request, reply) => {
    // TODO (Epic 5): validate idempotency key, store CombatAction, lock after timer
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** WebSocket /api/v1/combat/:id/ws – live combat events */
  server.get("/:id/ws", { websocket: true }, (socket, _request) => {
    // TODO (Epic 7): push CombatState updates over WebSocket
    socket.send(JSON.stringify({ event: "connected" }));
  });
}
