import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../appContext.js";
import { JOB_STATUSES } from "../../db/schema.js";

const enqueueSchema = z.object({
  title: z.string().min(1),
  mediaType: z.enum(["movie", "show", "anime", "music"]).optional(),
  year: z.number().int().optional(),
  season: z.number().int().nonnegative().optional(),
  episode: z.number().int().nonnegative().optional(),
  searchQuery: z.string().optional(),
  metadataId: z.string().min(1).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export function registerQueueRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/queue", async (request, reply) => {
    const body = enqueueSchema.parse(request.body);
    const job = ctx.queue.enqueue(body);
    reply.status(201).send(job);
  });

  app.get("/queue", async (request) => {
    const query = listQuerySchema.parse(request.query);
    return ctx.queue.listJobs(query);
  });

  app.get("/queue/stats", async () => {
    return ctx.queue.countByStatus();
  });
}
