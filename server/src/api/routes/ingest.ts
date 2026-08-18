import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../appContext.js";
import { NotFoundError, BadRequestError } from "../middleware/errorHandler.js";
import { ingestPlaylist, YoutubeIngestionDisabledError } from "../../services/youtube/playlistIngestion.js";
import { verifyPlaylist } from "../../services/youtube/verifyPlaylist.js";
import { PlaylistRunTracker } from "../../services/youtube/playlistRuns.js";
import { InvalidYoutubeUrlError } from "../../providers/download/youtube/urlValidation.js";

const ingestBodySchema = z.object({
  url: z.string().min(1),
  mediaType: z.literal("music").optional(),
});

const runIdParamsSchema = z.object({ runId: z.string().min(1) });

const verifyQuerySchema = z.object({ url: z.string().min(1) });

function mapKnownErrors(err: unknown): never {
  if (err instanceof YoutubeIngestionDisabledError) throw new BadRequestError(err.message);
  if (err instanceof InvalidYoutubeUrlError) throw new BadRequestError(err.message);
  if (err instanceof Error && /not a YouTube playlist URL/.test(err.message)) {
    throw new BadRequestError(err.message);
  }
  throw err;
}

export function registerIngestRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/ingest/youtube", async (request, reply) => {
    const body = ingestBodySchema.parse(request.body);
    try {
      const result = await ingestPlaylist(ctx, body.url);
      reply.status(201).send(result);
    } catch (err) {
      mapKnownErrors(err);
    }
  });

  app.get("/ingest/youtube/verify", async (request) => {
    const { url } = verifyQuerySchema.parse(request.query);
    try {
      return await verifyPlaylist(ctx, url);
    } catch (err) {
      mapKnownErrors(err);
    }
  });

  app.get("/ingest/youtube/:runId", async (request) => {
    const { runId } = runIdParamsSchema.parse(request.params);
    const runs = new PlaylistRunTracker(ctx.db);
    const run = runs.get(runId);
    if (!run) throw new NotFoundError(`Ingestion run "${runId}" not found`);

    const jobs = run.jobIds.map((id) => ctx.queue.getJob(id)).filter((j) => j !== undefined);
    const liveCounts: Record<string, number> = {};
    for (const job of jobs) {
      liveCounts[job.status] = (liveCounts[job.status] ?? 0) + 1;
    }

    return { ...run, liveCounts };
  });
}
