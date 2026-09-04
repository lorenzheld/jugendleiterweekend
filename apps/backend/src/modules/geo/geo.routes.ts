import type { FastifyInstance } from "fastify";

export async function geoRoutes(server: FastifyInstance): Promise<void> {
  /** GET /api/v1/geo/world-objects – visible objects near player */
  server.get("/world-objects", async (_request, reply) => {
    // TODO (Epic 3): query PostGIS for nearby WorldObjects using effectiveDistance
    return reply.status(501).send({ message: "Not implemented yet" });
  });

  /** POST /api/v1/geo/location – update player location */
  server.post("/location", async (_request, reply) => {
    // TODO (Epic 2): validate & store player GPS position via PostGIS
    return reply.status(501).send({ message: "Not implemented yet" });
  });
}
