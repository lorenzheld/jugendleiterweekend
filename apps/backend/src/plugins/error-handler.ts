import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

/**
 * Deterministic error handler – maps known error types to consistent HTTP responses.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Zod validation errors → 400
  if (error instanceof ZodError) {
    void reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Validation failed",
      issues: error.issues,
    });
    return;
  }

  // Fastify validation errors → 400
  if (error.validation) {
    void reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: error.message,
    });
    return;
  }

  // JWT errors → 401
  if (error.statusCode === 401) {
    void reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: error.message,
    });
    return;
  }

  // Forbidden → 403
  if (error.statusCode === 403) {
    void reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: error.message,
    });
    return;
  }

  // Not Found → 404
  if (error.statusCode === 404) {
    void reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: error.message,
    });
    return;
  }

  // Conflict (idempotency key clash) → 409
  if (error.statusCode === 409) {
    void reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: error.message,
    });
    return;
  }

  // Fallback → 500 (immer loggen, damit der echte Fehler sichtbar ist)
  request.log.error({ err: error, stack: error.stack }, "Unhandled error");
  void reply.status(500).send({
    statusCode: 500,
    error: "Internal Server Error",
    message:
      process.env["NODE_ENV"] === "production"
        ? "An unexpected error occurred"
        : (error.message ?? "An unexpected error occurred"),
  });
}
