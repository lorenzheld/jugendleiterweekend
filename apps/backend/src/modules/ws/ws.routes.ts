/**
 * WebSocket Routes
 * ----------------
 * HTTP endpoints for WebSocket recovery and diagnostics.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../../db/client.js";
import { wsEventLog } from "../../db/schema/index.js";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";

// ── Recovery endpoint schema ──────────────────────────────────────────────────

const EventsQuerySchema = z.object({
  since: z.string().datetime(),
});

interface EventsRequest extends FastifyRequest {
  query: z.infer<typeof EventsQuerySchema>;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function wsRoutes(server: FastifyInstance) {
  /**
   * GET /api/v1/ws/events?since=<ISO8601>
   * 
   * Returns all events for the authenticated player's team that occurred
   * after the given timestamp. Used for client reconnection recovery.
   * 
   * Security:
   *   - Requires valid JWT
   *   - Only returns events for the player's own team
   *   - Max recovery window: 5 minutes (prevents abuse)
   */
  server.get<{ Querystring: z.infer<typeof EventsQuerySchema> }>(
    "/events",
    {
      preHandler: server.authenticate,
    },
    async (request, reply) => {
      const { playerId, teamId } = request.user as {
        playerId: string;
        teamId: string;
      };
      const { since } = EventsQuerySchema.parse(request.query);

      // Validate recovery window (max 5 minutes)
      const sinceDate = new Date(since);
      const now = new Date();
      const maxRecoveryMs = 5 * 60 * 1000; // 5 minutes

      if (now.getTime() - sinceDate.getTime() > maxRecoveryMs) {
        return reply.status(400).send({
          message: "Recovery window too large (max 5 minutes)",
        });
      }

      // Fetch events from the event log
      const events = await db
        .select()
        .from(wsEventLog)
        .where(
          and(
            eq(wsEventLog.teamId, teamId),
            gt(wsEventLog.timestamp, sinceDate)
          )
        )
        .orderBy(wsEventLog.timestamp)
        .limit(100); // Safety limit

      return {
        events: events.map((e) => e.payload),
        count: events.length,
      };
    }
  );

  /**
   * GET /api/v1/ws/health
   * 
   * WebSocket health check and diagnostics.
   * Returns connection counts and room statistics.
   */
  server.get("/health", async () => ({
    status: "ok",
    connections: server.wsHub.connectionCount,
    rooms: server.wsHub.getRoomStats(),
  }));
}
