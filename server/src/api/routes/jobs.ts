import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../appContext.js";
import { NotFoundError, BadRequestError } from "../middleware/errorHandler.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

export function registerJobRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/jobs/:id", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    return job;
  });

  app.get("/jobs/:id/history", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    return ctx.queue.getHistory(id);
  });

  app.post("/jobs/:id/cancel", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    if (!ctx.queue.getJob(id)) throw new NotFoundError(`Job "${id}" not found`);
    ctx.queue.cancelJob(id);
    return ctx.queue.getJob(id);
  });

  app.post("/jobs/:id/pause", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "pending") throw new BadRequestError("Only pending jobs can be paused");
    ctx.queue.pauseJob(id);
    return ctx.queue.getJob(id);
  });

  app.post("/jobs/:id/resume", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "paused") throw new BadRequestError("Only paused jobs can be resumed");
    ctx.queue.resumeJob(id);
    return ctx.queue.getJob(id);
  });

  app.post("/jobs/:id/retry", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "failed" && job.status !== "cancelled") {
      throw new BadRequestError("Only failed or cancelled jobs can be retried");
    }
    ctx.queue.retryJob(id);
    return ctx.queue.getJob(id);
  });
}
