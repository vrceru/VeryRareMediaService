import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

function extractToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);

  const apiKeyHeader = request.headers["x-api-key"];
  if (typeof apiKeyHeader === "string") return apiKeyHeader;

  return undefined;
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Requires `Authorization: Bearer <API_KEY>` or `X-Api-Key: <API_KEY>` on every request. If
 * `apiKey` is undefined, auth is skipped entirely — the caller (server.ts) only registers this
 * hook when an API_KEY is configured, and a loud warning is logged at boot when it isn't.
 */
export function requireApiKey(apiKey: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const provided = extractToken(request);
    if (!provided || !tokensMatch(provided, apiKey)) {
      reply.status(401).send({
        error: "Unauthorized",
        message: "Missing or invalid API key. Send it as 'Authorization: Bearer <key>' or 'X-Api-Key: <key>'.",
      });
    }
  };
}
