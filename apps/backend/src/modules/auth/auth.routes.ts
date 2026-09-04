import type { FastifyInstance } from "fastify";
import { LoginRequestSchema } from "@jlw/contracts";

export async function authRoutes(server: FastifyInstance): Promise<void> {
  /** POST /api/v1/auth/login */
  server.post("/login", async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    // TODO (Epic 2): validate accessCode against DB, create session, sign JWT
    void body;
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** DELETE /api/v1/auth/session */
  server.delete(
    "/session",
    { onRequest: [server.authenticate] },
    async (_request, reply) => {
      // TODO (Epic 2): invalidate session token
      return reply.status(501).send({ message: "Not implemented yet" });
    },
  );
}
