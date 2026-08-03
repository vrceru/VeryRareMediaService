import type { PipelineContext } from "../types.js";
import { cleanupJobTempDir } from "../../services/cleanup/tempStorage.js";

export const STAGE = "archive";

/** Final stage: cleans up the job's temp download directory and writes the closing history entry. */
export async function archiveHistory(ctx: PipelineContext): Promise<void> {
  await cleanupJobTempDir(ctx.app.config.storage.downloadTempDir, ctx.job.id);
  ctx.app.queue.appendHistory(ctx.job.id, STAGE, "completed", "Job archived, temp files cleaned up");
}
