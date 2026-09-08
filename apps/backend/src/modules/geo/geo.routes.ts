/**
 * Geo Routes
 * ----------
 * POST /api/v1/geo/location      – update authenticated player's GPS position
 * GET  /api/v1/geo/world-objects – (Epic 3) nearby world objects
 */

import type { FastifyInstance } from "fastify";
import { UpdateLocationRequestSchema } from "@jlw/contracts";
import { updatePlayerLocation } from "./geo.service.js";

export async function geoRoutes(server: FastifyInstance): Promise<void> {
  // ── POST /location ──────────────────────────────────────────────────────────
  server.post(
    "/location",
    { onRequest: [server.authenticate] },
    async (request, reply) => {
      // 1. Validate body
      const body = UpdateLocationRequestSchema.parse(request.body);

      // 2. Extract accountId from verified JWT
      const { sub: accountId } = request.user as { sub: string };

      // 3. Persist location and return confirmation
      const result = await updatePlayerLocation({
        accountId,
        lat: body.lat,
        lng: body.lng,
        accuracy: body.accuracy,
      });

      return reply.status(200).send(result);
    },
  );

  // ── GET /world-objects ──────────────────────────────────────────────────────
  server.get(
    "/world-objects",
    { onRequest: [server.authenticate] },
    async (_request, reply) => {
      // TODO (Epic 3): query PostGIS for nearby WorldObjects using effectiveDistance
      return reply.status(501).send({ message: "Not implemented yet" });
    },
  );
}
