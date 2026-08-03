import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";

export const STAGE = "await_release_approval";

/**
 * Gate A: pauses the job for an admin to approve the auto-selected release, pick a different
 * candidate, or deny it — see GET/POST /api/approvals/releases* and pipeline/approvals.ts.
 * runner.ts stops advancing once it sees the job's status flip to "awaiting_release_approval"
 * (set here), so nothing after this point runs until an admin acts.
 */
export async function awaitReleaseApproval(ctx: PipelineContext): Promise<void> {
  const candidates = ctx.state.releaseCandidates;
  if (!candidates || candidates.length === 0) {
    throw new PipelineStageError(STAGE, "No release candidates to hold for approval");
  }

  ctx.app.queue.holdForReleaseApproval(ctx.job.id, candidates);
}
