/**
 * Geo Routes
 * ──────────
 * POST /api/v1/geo/location        – Update authenticated player's GPS position,
 *                                    run spatial engine, emit WS radius events.
 * GET  /api/v1/geo/world-objects   – Return WorldObjects within discovery radius
 *                                    of the player's last known position.
 * GET  /api/v1/geo/ws              – WebSocket endpoint for team radius events.
 *                                    Auth via ?token=<jwt> query param (browsers
 *                                    cannot set Authorization headers on WS upgrades).
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  UpdateLocationRequestSchema,
  WorldObjectsResponseSchema,
  WsConnectedEventSchema,
  PlayAreasResponseSchema,
} from "@jlw/contracts";
import {
  updatePlayerLocation,
  getNearbyWorldObjects,
  getPlayAreas,
} from "./geo.service.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { players } from "../../db/schema/player.js";

// ── Query param schema for world-objects ──────────────────────────────────────

const WorldObjectsQuerySchema = z.object({
  /**
   * Override GPS accuracy for the nearby query (metres).
   * When omitted the server uses the player's last stored accuracy,
   * defaulting to 15 m if no value is available.
   */
  accuracy: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(500))
    .optional(),
});

// ── WS token query schema ─────────────────────────────────────────────────────

const WsQuerySchema = z.object({
  token: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────

export async function geoRoutes(server: FastifyInstance): Promise<void> {
  // ── POST /location ──────────────────────────────────────────────────────────
  server.post(
    "/location",
    { onRequest: [server.authenticate] },
    async (request, reply) => {
      const body = UpdateLocationRequestSchema.parse(request.body);
      const { sub: accountId } = request.user as { sub: string };

      const result = await updatePlayerLocation({
        accountId,
        lat: body.lat,
        lng: body.lng,
        accuracy: body.accuracy,
        wsHub: server.wsHub,
      });

      return reply.status(200).send(result);
    },
  );

  // ── GET /world-objects ──────────────────────────────────────────────────────
  /**
   * Returns all publishable WorldObjects within discovery_radius_m of the
   * player's last known position, sorted by effective distance ascending.
   *
   * Query params:
   *   accuracy (optional) – GPS accuracy in metres; defaults to 15.
   */
  server.get(
    "/world-objects",
    { onRequest: [server.authenticate] },
    async (request, reply) => {
      const { sub: accountId } = request.user as { sub: string };

      const query = WorldObjectsQuerySchema.parse(request.query);
      const accuracy = query.accuracy ?? 15;

      const { objects, playerLat, playerLng } = await getNearbyWorldObjects({
        accountId,
        accuracy,
      });

      const response = WorldObjectsResponseSchema.parse({
        objects,
        playerLat,
        playerLng,
        accuracy,
      });

      return reply.status(200).send(response);
    },
  );

  // ── GET /play-areas ─────────────────────────────────────────────────────────
  /**
   * Returns all play-area boundary polygons ordered by day number.
   * Each area carries an optional GeoJSON geometry that the player client
   * renders as a day-boundary overlay on the map.
   *
   * Results are stable for the lifetime of a game event, so clients may
   * cache aggressively (Cache-Control: public, max-age=300).
   */
  server.get(
    "/play-areas",
    { onRequest: [server.authenticate] },
    async (_request, reply) => {
      const areas = await getPlayAreas();
      const body = PlayAreasResponseSchema.parse({ areas });
      return reply
        .header("Cache-Control", "public, max-age=300")
        .status(200)
        .send(body);
    },
  );

  // ── GET /ws – WebSocket endpoint ────────────────────────────────────────────
  /**
   * Authenticated WebSocket for receiving team radius events.
   *
   * Flow:
   *   1. Client connects with ?token=<jwt>
   *   2. Server verifies JWT and resolves player + teamId
   *   3. Socket is registered in the team room in wsHub
   *   4. Server sends ws.connected event with current nearby objects
   *   5. Server pushes radius.transition events as the player (or teammates) move
   *
   * Client must handle:
   *   - radius.transition: update map marker state + trigger game mechanics
   *   - ws.connected: bootstrap initial nearby-objects overlay
   *
   * Auth: JWT passed as ?token= query param (browser WS limitation).
   * Token is verified with the same secret as HTTP requests.
   */
  server.get(
    "/ws",
    { websocket: true },
    async (socket, request) => {
      // ── 1. Verify JWT from query param ──────────────────────────────────────
      let accountId: string;
      try {
        const query = WsQuerySchema.parse(request.query);
        // Temporarily inject token into Authorization header for jwtVerify
        // by overriding the header on the internal request object.
        (request.headers as Record<string, string>)["authorization"] =
          `Bearer ${query.token}`;
        await request.jwtVerify();
        const { sub } = request.user as { sub: string };
        accountId = sub;
      } catch {
        socket.send(
          JSON.stringify({ event: "ws.error", message: "Unauthorized" }),
        );
        socket.close(4001, "Unauthorized");
        return;
      }

      // ── 2. Resolve player + teamId ─────────────────────────────────────────
      const [player] = await db
        .select({
          id: players.id,
          teamId: players.teamId,
          lastLat: players.lastLat,
          lastLng: players.lastLng,
        })
        .from(players)
        .where(eq(players.accountId, accountId));

      if (!player) {
        socket.send(
          JSON.stringify({
            event: "ws.error",
            message: "No player record for this account",
          }),
        );
        socket.close(4003, "Player not found");
        return;
      }

      // ── 3. Register in team room ───────────────────────────────────────────
      server.wsHub.register(socket, player.teamId);

      // ── 4. Send ws.connected with current nearby objects ──────────────────
      try {
        const { objects, playerLat, playerLng } = await getNearbyWorldObjects({
          accountId,
          accuracy: 15, // conservative default for initial snapshot
        });

        const connectedEvent = WsConnectedEventSchema.parse({
          event: "ws.connected",
          playerId: player.id,
          teamId: player.teamId,
          nearbyObjects: objects,
          timestamp: new Date().toISOString(),
        });

        socket.send(JSON.stringify(connectedEvent));

        server.log.info(
          {
            playerId: player.id,
            teamId: player.teamId,
            nearbyCount: objects.length,
            playerLat,
            playerLng,
          },
          "ws: player connected",
        );
      } catch (err) {
        server.log.warn({ err }, "ws: failed to send connected event");
      }

      // The socket is now managed by wsHub; no further work needed here.
      // Cleanup is handled by ws.on("close") registered in wsHub.register().
    },
  );
}
