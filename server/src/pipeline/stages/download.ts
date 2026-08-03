import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { ensureJobTempDir } from "../../services/cleanup/tempStorage.js";

export const STAGE = "download";

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 6 * 60 * 60 * 1000; // 6 hours

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function download(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Starting download");

  const { selectedRelease } = ctx.state;
  if (!selectedRelease) {
    throw new PipelineStageError(STAGE, "No release selected before download stage");
  }

  // Normally set by selectRelease.ts — but when resuming after release approval, that stage
  // was skipped, so state.downloadProvider is empty and must be re-derived from the persisted
  // release's providerId instead.
  const downloadProvider = ctx.state.downloadProvider ?? ctx.app.downloadProviders.get(selectedRelease.providerId);
  if (!downloadProvider) {
    throw new PipelineStageError(STAGE, `Unknown download provider "${selectedRelease.providerId}"`);
  }
  ctx.state.downloadProvider = downloadProvider;

  const tempDir = await ensureJobTempDir(ctx.app.config.storage.downloadTempDir, ctx.job.id);
  ctx.state.tempDir = tempDir;

  const downloadRef = await downloadProvider.addDownload(selectedRelease, tempDir);
  ctx.app.queue.setDownloadRef(ctx.job.id, downloadProvider.id, downloadRef);
  await ctx.app.notifications.dispatch({
    type: "download.started",
    title: "Download started",
    message: `${selectedRelease.title} via ${downloadProvider.displayName}`,
    jobId: ctx.job.id,
  });

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const status = await downloadProvider.getStatus(downloadRef);
    ctx.app.queue.updateProgress(ctx.job.id, status.progress);

    if (status.state === "completed") {
      ctx.state.downloadSavePath = status.savePath ?? tempDir;
      await ctx.app.notifications.dispatch({
        type: "download.completed",
        title: "Download completed",
        message: selectedRelease.title,
        jobId: ctx.job.id,
      });
      return;
    }
    if (status.state === "error") {
      throw new PipelineStageError(STAGE, status.errorMessage ?? "Download reported an error state");
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new PipelineStageError(STAGE, "Download timed out");
}
