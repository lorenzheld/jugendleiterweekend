/**
 * Backend entry point – Fastify server.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwtPlugin from "@fastify/jwt";
import websocketPlugin from "@fastify/websocket";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { geoRoutes } from "./modules/geo/geo.routes.js";
import { questRoutes } from "./modules/quest/quest.routes.js";
import { combatRoutes } from "./modules/combat/combat.routes.js";
import { economyRoutes } from "./modules/economy/economy.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { errorHandler } from "./plugins/error-handler.js";

const HOST = process.env["HOST"] ?? "0.0.0.0";
const PORT = Number(process.env["PORT"] ?? 3000);

const server = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
  },
});

// ── Plugins ──────────────────────────────────────────────────────────────────
await server.register(helmet);
await server.register(cors, { origin: true });
await server.register(jwtPlugin, {
  secret: process.env["JWT_SECRET"] ?? "changeme-dev-secret",
});
await server.register(websocketPlugin);

// ── Authenticate decorator (used as preHandler in protected routes) ────────
server.decorate(
  "authenticate",
  async function (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      void reply.send(err);
    }
  },
);

// ── Error handler ─────────────────────────────────────────────────────────────
server.setErrorHandler(errorHandler);

// ── Routes ────────────────────────────────────────────────────────────────────
await server.register(authRoutes, { prefix: "/api/v1/auth" });
await server.register(geoRoutes, { prefix: "/api/v1/geo" });
await server.register(questRoutes, { prefix: "/api/v1/quests" });
await server.register(combatRoutes, { prefix: "/api/v1/combat" });
await server.register(economyRoutes, { prefix: "/api/v1/economy" });
await server.register(mediaRoutes, { prefix: "/api/v1/media" });

// ── Health check ──────────────────────────────────────────────────────────────
server.get("/health", async () => ({ status: "ok" }));

// ── Start ─────────────────────────────────────────────────────────────────────
try {
  await server.listen({ port: PORT, host: HOST });
  server.log.info(`Server running at http://${HOST}:${PORT}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
