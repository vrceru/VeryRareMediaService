import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";

export const STAGE = "await_final_approval";

/**
 * Gate B: pauses the job for an admin to review the matched metadata and downloaded file
 * before it's renamed/organized into the library and pushed to Jellyfin — see
 * GET/POST /api/approvals/final* and pipeline/approvals.ts. Same stop-the-loop mechanism as
 * Gate A (awaitReleaseApproval.ts).
 */
export async function awaitFinalApproval(ctx: PipelineContext): Promise<void> {
  const { metadata, primaryMediaFile } = ctx.state;
  if (!metadata || !primaryMediaFile) {
    throw new PipelineStageError(STAGE, "Missing metadata or primary media file to hold for approval");
  }

  ctx.app.queue.holdForFinalApproval(ctx.job.id, metadata, primaryMediaFile);
}
