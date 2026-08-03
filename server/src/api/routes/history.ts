import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../appContext.js";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

/** Completed/failed/cancelled jobs — the archived job history the pipeline's final stage produces. */
export function registerHistoryRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/history", async (request) => {
    const { limit, offset } = historyQuerySchema.parse(request.query);
    return ctx.queue.listJobs({ status: ["completed", "failed", "cancelled"], limit, offset });
  });
}
