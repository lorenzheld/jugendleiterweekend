import "@fastify/jwt";
import type { WsHub } from "../modules/ws/ws.hub.js";

/**
 * Augments FastifyInstance with custom decorators:
 *  - authenticate  preHandler registered by @fastify/jwt
 *  - wsHub         WebSocket team-room hub (Epic 2)
 */
declare module "fastify" {
  interface FastifyInstance {
    authenticate: import("fastify").preHandlerHookHandler;
    /** WebSocket hub for team-scoped radius-event broadcasting. */
    wsHub: WsHub;
  }
}
