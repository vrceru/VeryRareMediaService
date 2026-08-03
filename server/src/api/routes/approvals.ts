import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../appContext.js";
import { NotFoundError, BadRequestError } from "../middleware/errorHandler.js";
import { approveRelease, denyRelease, approveFinal, denyFinal, ApprovalError } from "../../pipeline/approvals.js";
import { parseReleaseName } from "../../services/releaseParsing/releaseParser.js";
import { computeQualityScore } from "../../services/releaseParsing/qualityScore.js";
import { checkSpace } from "../../services/storage/diskSpace.js";

const idParamsSchema = z.object({ id: z.string().min(1) });
const approveReleaseBodySchema = z.object({ candidateId: z.string().min(1).optional() }).optional();

export function registerApprovalRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/approvals/releases", async () => {
    const jobs = ctx.queue.listJobs({ status: "awaiting_release_approval", limit: 100 });
    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      mediaType: job.mediaType,
      autoSelectedId: job.selectedRelease?.id ?? null,
      candidates: (job.releaseCandidates ?? []).map((candidate) => {
        const parsed = parseReleaseName(candidate.title);
        return {
          ...candidate,
          parsed,
          technicalQualityScore: computeQualityScore(parsed),
        };
      }),
    }));
  });

  app.post("/jobs/:id/approve-release", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = approveReleaseBodySchema.parse(request.body);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "awaiting_release_approval") {
      throw new BadRequestError("Job is not awaiting release approval");
    }
    try {
      approveRelease(ctx, job, body?.candidateId);
    } catch (err) {
      if (err instanceof ApprovalError) throw new BadRequestError(err.message);
      throw err;
    }
    return ctx.queue.getJob(id);
  });

  app.post("/jobs/:id/deny-release", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "awaiting_release_approval") {
      throw new BadRequestError("Job is not awaiting release approval");
    }
    await denyRelease(ctx, job);
    return ctx.queue.getJob(id);
  });

  app.get("/approvals/final", async () => {
    const jobs = ctx.queue.listJobs({ status: "awaiting_final_approval", limit: 100 });
    return Promise.all(
      jobs.map(async (job) => {
        const libraryRoot = job.mediaType ? ctx.config.storage.libraryDirs[job.mediaType] : undefined;
        let space: { freeBytes: number; requiredBytes: number; hasEnoughSpace: boolean } | { error: string };
        try {
          if (!job.primaryMediaFile || !libraryRoot) throw new Error("missing file or library root");
          const fileSize = (await stat(job.primaryMediaFile)).size;
          space = await checkSpace(libraryRoot, fileSize);
        } catch (err) {
          space = { error: err instanceof Error ? err.message : String(err) };
        }
        return {
          id: job.id,
          title: job.title,
          mediaType: job.mediaType,
          metadata: job.metadata,
          primaryMediaFile: job.primaryMediaFile,
          storage: space,
        };
      }),
    );
  });

  app.post("/jobs/:id/approve-final", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "awaiting_final_approval") {
      throw new BadRequestError("Job is not awaiting final approval");
    }
    approveFinal(ctx, job);
    return ctx.queue.getJob(id);
  });

  app.post("/jobs/:id/deny-final", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const job = ctx.queue.getJob(id);
    if (!job) throw new NotFoundError(`Job "${id}" not found`);
    if (job.status !== "awaiting_final_approval") {
      throw new BadRequestError("Job is not awaiting final approval");
    }
    await denyFinal(ctx, job);
    return ctx.queue.getJob(id);
  });
}
