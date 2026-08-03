import type { PipelineContext } from "../types.js";

export const STAGE = "update_jellyfin";

export async function updateJellyfin(ctx: PipelineContext): Promise<void> {
  if (!ctx.app.jellyfin) {
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "Jellyfin not configured, skipping");
    return;
  }

  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Notifying Jellyfin of new media");

  const path = ctx.state.destinationPath ?? ctx.state.organizedItemDir;
  try {
    if (path) {
      await ctx.app.jellyfin.notifyPathUpdated(path, "Created");
    } else {
      await ctx.app.jellyfin.refreshLibrary();
    }
    await ctx.app.notifications.dispatch({
      type: "library.updated",
      title: "Jellyfin library updated",
      message: ctx.state.metadata?.title ?? ctx.job.title,
      jobId: ctx.job.id,
    });
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "Jellyfin notified");
  } catch (err) {
    // Jellyfin being unreachable shouldn't fail the whole job — the file is already organized.
    ctx.app.logger.warn(
      { jobId: ctx.job.id, err: err instanceof Error ? err.message : err },
      "failed to notify Jellyfin",
    );
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "Jellyfin notification failed (non-fatal)");
  }
}
