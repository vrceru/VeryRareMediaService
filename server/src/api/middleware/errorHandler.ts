import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("api");

export class NotFoundError extends Error {}
export class BadRequestError extends Error {}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: "ValidationError",
      message: "Request failed validation",
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (error instanceof BadRequestError) {
    reply.status(400).send({ error: "BadRequest", message: error.message });
    return;
  }

  if (error instanceof NotFoundError) {
    reply.status(404).send({ error: "NotFound", message: error.message });
    return;
  }

  log.error({ err: error, path: request.url }, "unhandled API error");
  reply.status(500).send({ error: "InternalServerError", message: "An unexpected error occurred" });
}
