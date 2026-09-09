/**
 * GM Dashboard Routes – Epic 9
 * Endpoints for live dashboard data (player positions, team status, world objects).
 */

import type { FastifyPluginAsync } from "fastify";
import { GMDashboardService } from "./gm-dashboard.service.js";
import { MediaService } from "../media/media.service.js";
import { teams } from "../../db/schema/player.js";
import { db } from "../../db/client.js";
import { eq } from "drizzle-orm";

export const gmDashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const dashboardService = new GMDashboardService(fastify.log);
  const mediaService = new MediaService(fastify.log);

  // ── GET /api/v1/gm/dashboard/player-positions ───────────────────────────────
  fastify.get("/dashboard/player-positions", async (request, reply) => {
    const positions = await dashboardService.getAllPlayerPositions();
    return reply.send(positions);
  });

  // ── GET /api/v1/gm/dashboard/team-status ────────────────────────────────────
  fastify.get("/dashboard/team-status", async (request, reply) => {
    const status = await dashboardService.getAllTeamStatus();
    return reply.send(status);
  });

  // ── GET /api/v1/gm/dashboard/world-objects ──────────────────────────────────
  fastify.get("/dashboard/world-objects", async (request, reply) => {
    const objects = await dashboardService.getAllWorldObjects();
    return reply.send(objects);
  });

  // ── GET /api/v1/gm/dashboard/media-inbox ────────────────────────────────────
  fastify.get("/dashboard/media-inbox", async (request, reply) => {
    const submissions = await mediaService.getPendingSubmissions();

    // Enrich with team names
    const enriched = await Promise.all(
      submissions.map(async (submission) => {
        const [team] = await db
          .select({ name: teams.name })
          .from(teams)
          .where(eq(teams.id, submission.teamId))
          .limit(1);

        return {
          ...submission,
          teamName: team?.name ?? "Unknown",
        };
      }),
    );

    return reply.send(enriched);
  });
};
