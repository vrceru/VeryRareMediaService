import type { PipelineContext } from "../types.js";

export const STAGE = "log_completion";

export async function logCompletion(ctx: PipelineContext): Promise<void> {
  const durationMs = ctx.job.startedAt ? Date.now() - ctx.job.startedAt : undefined;

  ctx.app.logger.info(
    {
      jobId: ctx.job.id,
      title: ctx.job.title,
      mediaType: ctx.job.mediaType,
      destinationPath: ctx.state.destinationPath,
      durationMs,
    },
    "job pipeline completed",
  );

  ctx.app.queue.completeJob(ctx.job.id, `Completed in ${durationMs ?? "?"}ms`);
}
