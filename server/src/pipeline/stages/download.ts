import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { JobCancelledError } from "../../queue/types.js";
import { ensureJobTempDir } from "../../services/cleanup/tempStorage.js";
import type { DownloadStatus } from "../../providers/download/types.js";

export const STAGE = "download";

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 6 * 60 * 60 * 1000; // 6 hours
// A search index's advertised seeder count can be stale or outright fake (confirmed in
// production: a release listed with 5000+ seeders had zero actual connected peers). Bail out
// of an apparently-dead torrent long before MAX_WAIT_MS rather than leaving it silently stuck
// for hours -- 30 polls at POLL_INTERVAL_MS is enough for a real swarm to show *some* sign of
// life without false-triggering on a normal slow DHT bootstrap.
const NO_PEERS_TIMEOUT_MS = 90 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** connectedPeers undefined means the provider can't report it (e.g. usenet) -- assume healthy
 * rather than risk false-failing a provider this check doesn't meaningfully apply to. */
export function hasSignOfLife(status: DownloadStatus): boolean {
  return status.progress > 0 || status.connectedPeers === undefined || status.connectedPeers > 0;
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
  let noPeersSince: number | undefined;
  while (Date.now() < deadline) {
    // A cancelled job's DB row won't naturally stop this loop on its own -- check every poll
    // so a mid-download cancel (POST /api/jobs/:id/cancel) frees this worker slot within one
    // poll interval instead of running for up to MAX_WAIT_MS.
    if (ctx.app.queue.getJob(ctx.job.id)?.status === "cancelled") {
      throw new JobCancelledError(ctx.job.id);
    }

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

    if (hasSignOfLife(status)) {
      noPeersSince = undefined;
    } else {
      noPeersSince ??= Date.now();
      if (Date.now() - noPeersSince >= NO_PEERS_TIMEOUT_MS) {
        throw new PipelineStageError(
          STAGE,
          `No peers found for "${selectedRelease.title}" after ${Math.round(NO_PEERS_TIMEOUT_MS / 1000)}s — ` +
            "likely a dead or fake-seeded release despite its advertised seeder count",
        );
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new PipelineStageError(STAGE, "Download timed out");
}
