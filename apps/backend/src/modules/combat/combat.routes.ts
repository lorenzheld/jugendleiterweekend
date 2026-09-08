/**
 * Combat Routes (Epic 6)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getCombatInstance,
  submitCombatAction,
  lockAndResolveRound,
  getActiveCombatForTeam,
} from "./combat.service.js";

const submitActionSchema = z.object({
  actionType: z.enum(["ATTACK", "DEFEND", "SKILL", "FLEE"]),
  targetId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
});

export async function combatRoutes(server: FastifyInstance): Promise<void> {
  /** GET /api/v1/combat/:id – get combat instance state */
  server.get(
    "/:id",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const combat = await getCombatInstance(id);
        return reply.send(combat);
      } catch (err) {
        server.log.error(err);
        return reply.status(404).send({ error: "Combat not found" });
      }
    }
  );

  /** GET /api/v1/combat/team/active – get active combat for authenticated player's team */
  server.get(
    "/team/active",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const { teamId } = request.user as { teamId: string };

      try {
        const combat = await getActiveCombatForTeam(teamId);
        if (!combat) {
          return reply.status(404).send({ error: "No active combat" });
        }
        return reply.send(combat);
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ error: "Failed to get active combat" });
      }
    }
  );

  /** POST /api/v1/combat/:id/action – submit round action */
  server.post(
    "/:id/action",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { playerId } = request.user as { playerId: string };

      try {
        const body = submitActionSchema.parse(request.body);

        const action = await submitCombatAction({
          combatId: id,
          playerId,
          actionType: body.actionType,
          targetId: body.targetId,
          idempotencyKey: body.idempotencyKey,
        });

        // Emit WS event to team
        const combat = await getCombatInstance(id);
        const playerCombatant = combat.combatants.find(
          (c) => c.entityId === playerId
        );

        if (playerCombatant?.teamId && server.wsHub) {
          server.wsHub.sendToTeam(playerCombatant.teamId, {
            event: "combat:action_submitted",
            data: { combatId: id, action },
          });
        }

        return reply.send(action);
      } catch (err) {
        server.log.error(err);
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: err.errors });
        }
        return reply.status(400).send({ error: (err as Error).message });
      }
    }
  );

  /** POST /api/v1/combat/:id/resolve – manually resolve round (for testing/GM) */
  server.post(
    "/:id/resolve",
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const logs = await lockAndResolveRound(id, server.wsHub);
        return reply.send({ logs });
      } catch (err) {
        server.log.error(err);
        return reply.status(400).send({ error: (err as Error).message });
      }
    }
  );

  /** WebSocket /api/v1/combat/:id/ws – live combat events */
  server.get("/:id/ws", { websocket: true }, (socket, request) => {
    const { id } = request.params as { id: string };

    server.log.info(`WebSocket connected for combat ${id}`);

    socket.on("message", (message) => {
      server.log.debug(`Combat WS message: ${message}`);
    });

    socket.on("close", () => {
      server.log.info(`WebSocket closed for combat ${id}`);
    });

    // Send initial connection confirmation
    socket.send(
      JSON.stringify({
        event: "combat:connected",
        data: { combatId: id },
      })
    );
  });
}
