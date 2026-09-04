import "@fastify/jwt";

/**
 * Augments FastifyInstance with the `authenticate` preHandler decorator
 * registered by @fastify/jwt.
 */
declare module "fastify" {
  interface FastifyInstance {
    authenticate: import("fastify").preHandlerHookHandler;
  }
}
