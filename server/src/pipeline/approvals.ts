import type { AppContext } from "../appContext.js";
import type { Job } from "../queue/types.js";
import { stageAfter } from "./runner.js";
import { STAGE as AWAIT_RELEASE_APPROVAL } from "./stages/awaitReleaseApproval.js";
import { STAGE as AWAIT_FINAL_APPROVAL } from "./stages/awaitFinalApproval.js";
import { cleanupJobTempDir } from "../services/cleanup/tempStorage.js";

/** Orchestration for the two admin-approval gates — called directly by api/routes/approvals.ts.
 * Callers are expected to have already verified the job exists and is in the right status
 * (the same pattern api/routes/jobs.ts already uses for cancel/pause/resume/retry). */

function requireNextStage(gateStageName: string): string {
  const next = stageAfter(gateStageName);
  if (!next) {
    throw new Error(`Pipeline configuration error: no stage follows "${gateStageName}"`);
  }
  return next;
}

export class ApprovalError extends Error {}

/** Approves the release Gate A held. `chosenCandidateId` lets the admin switch to a different
 * candidate than the one auto-selected; omit it to keep the original pick. */
export function approveRelease(app: AppContext, job: Job, chosenCandidateId?: string): void {
  const chosen = chosenCandidateId
    ? job.releaseCandidates?.find((c) => c.id === chosenCandidateId)
    : job.selectedRelease;

  if (!chosen) {
    throw new ApprovalError(
      chosenCandidateId
        ? `No candidate with id "${chosenCandidateId}" was found among this job's release candidates`
        : "Job has no selected release to approve",
    );
  }

  app.queue.setSelectedRelease(job.id, chosen);
  app.queue.resumeAtStage(
    job.id,
    requireNextStage(AWAIT_RELEASE_APPROVAL),
    chosenCandidateId ? "Release approved by admin (switched candidate)" : "Release approved by admin",
  );
}

/** Approves the final review Gate B held, letting the job proceed to organize into the library
 * and update Jellyfin. */
export function approveFinal(app: AppContext, job: Job): void {
  app.queue.resumeAtStage(job.id, requireNextStage(AWAIT_FINAL_APPROVAL), "Final approved by admin");
}

/** Shared deny behavior for both gates: cancel the job and clean up its temp directory. Cancel
 * alone (the pre-existing POST /api/jobs/:id/cancel path) doesn't clean up temp files today —
 * deny always should, since a denied job has nothing left to resume for. */
async function denyAndCleanup(app: AppContext, job: Job): Promise<void> {
  app.queue.cancelJob(job.id);
  await cleanupJobTempDir(app.config.storage.downloadTempDir, job.id);
}

export async function denyRelease(app: AppContext, job: Job): Promise<void> {
  await denyAndCleanup(app, job);
}

export async function denyFinal(app: AppContext, job: Job): Promise<void> {
  await denyAndCleanup(app, job);
}
