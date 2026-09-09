/**
 * Boss Combat Routes (Epic 8)
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  getOrCreateBossCombat,
  joinBossCombat,
  submitGlobalAction,
  getBossCombatStatus,
} from "./boss.service.js";
import {
  BossJoinRequestBodySchema,
  BossGlobalActionBodySchema,
} from "@jlw/contracts";

export async function bossRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/boss/:worldObjectId/status
   * Get the status of a boss encounter (active, HP, participating teams).
   */
  server.get<{ Params: { worldObjectId: string } }>(
    "/:worldObjectId/status",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      try {
        const status = await getBossCombatStatus(request.params.worldObjectId);
        return reply.send(status);
      } catch (err) {
        server.log.error(err, "Failed to get boss status");
        return reply.status(500).send({ error: "Failed to get boss status" });
      }
    },
  );

  /**
   * POST /api/v1/boss/:worldObjectId/join
   * Join an active boss combat or create a new one.
   * Triggered by geofencing when team enters boss_join_radius_m.
   */
  server.post<{
    Params: { worldObjectId: string };
    Body: { playerId: string };
  }>(
    "/:worldObjectId/join",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const body = BossJoinRequestBodySchema.parse(request.body);
      const teamId = (request.user as { teamId: string }).teamId;

      if (!teamId) {
        return reply.status(400).send({ error: "User has no team" });
      }

      try {
        // Get or create boss combat
        const combat = await getOrCreateBossCombat({
          worldObjectId: request.params.worldObjectId,
          wsHub: server.wsHub,
        });

        // Join the team to the boss combat
        await joinBossCombat({
          combatId: combat.id,
          teamId,
          wsHub: server.wsHub,
        });

        return reply.send({ combatId: combat.id, status: "joined" });
      } catch (err) {
        server.log.error(err, "Failed to join boss combat");
        return reply.status(400).send({ error: (err as Error).message });
      }
    },
  );

  /**
   * POST /api/v1/boss/:combatId/global-action
   * Submit a global boss action (APPLAUD, CHEER, COORDINATED_ATTACK).
   */
  server.post<{
    Params: { combatId: string };
    Body: { actionType: string; teamId: string };
  }>(
    "/:combatId/global-action",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const body = BossGlobalActionBodySchema.parse(request.body);
      const userTeamId = (request.user as { teamId: string }).teamId;

      // Verify that the action is from the user's team
      if (body.teamId !== userTeamId) {
        return reply.status(403).send({ error: "Cannot submit action for another team" });
      }

      try {
        await submitGlobalAction({
          combatId: request.params.combatId,
          teamId: body.teamId,
          actionType: body.actionType as "APPLAUD" | "CHEER" | "COORDINATED_ATTACK",
          wsHub: server.wsHub,
        });

        return reply.send({ status: "action_submitted" });
      } catch (err) {
        server.log.error(err, "Failed to submit global action");
        return reply.status(400).send({ error: (err as Error).message });
      }
    },
  );
}
