import type { AppContext } from "../appContext.js";
import type { Job } from "../queue/types.js";
import type { PipelineContext, PipelineState } from "./types.js";
import { parseReleaseName } from "../services/releaseParsing/releaseParser.js";
import { validateRequest, STAGE as VALIDATE_REQUEST } from "./stages/validateRequest.js";
import { searchProviders, STAGE as SEARCH_PROVIDERS } from "./stages/searchProviders.js";
import { selectRelease, STAGE as SELECT_RELEASE } from "./stages/selectRelease.js";
import { awaitReleaseApproval, STAGE as AWAIT_RELEASE_APPROVAL } from "./stages/awaitReleaseApproval.js";
import { download, STAGE as DOWNLOAD } from "./stages/download.js";
import { verifyDownload, STAGE as VERIFY_DOWNLOAD } from "./stages/verifyDownload.js";
import { virusScan, STAGE as VIRUS_SCAN } from "./stages/virusScan.js";
import { extractArchive, STAGE as EXTRACT_ARCHIVE } from "./stages/extractArchive.js";
import { validateMedia, STAGE as VALIDATE_MEDIA } from "./stages/validateMedia.js";
import { identifyMedia, STAGE as IDENTIFY_MEDIA } from "./stages/identifyMedia.js";
import { fetchMetadata, STAGE as FETCH_METADATA } from "./stages/fetchMetadata.js";
import { awaitFinalApproval, STAGE as AWAIT_FINAL_APPROVAL } from "./stages/awaitFinalApproval.js";
import { renameFiles, STAGE as RENAME_FILES } from "./stages/renameFiles.js";
import { organizeLibrary, STAGE as ORGANIZE_LIBRARY } from "./stages/organizeLibrary.js";
import { generateArtwork, STAGE as GENERATE_ARTWORK } from "./stages/generateArtwork.js";
import { updateJellyfin, STAGE as UPDATE_JELLYFIN } from "./stages/updateJellyfin.js";
import { sendNotifications, STAGE as SEND_NOTIFICATIONS } from "./stages/sendNotifications.js";
import { logCompletion, STAGE as LOG_COMPLETION } from "./stages/logCompletion.js";
import { archiveHistory, STAGE as ARCHIVE_HISTORY } from "./stages/archiveHistory.js";

export interface PipelineStage {
  name: string;
  run: (ctx: PipelineContext) => Promise<void>;
}

/** The full pipeline, in order, including the two admin-approval gates. "Receive media
 * request" (stage 1 of the original spec) happens at enqueue time in QueueService.enqueue and
 * isn't a step here. */
export const STAGES: PipelineStage[] = [
  { name: VALIDATE_REQUEST, run: validateRequest },
  { name: SEARCH_PROVIDERS, run: searchProviders },
  { name: SELECT_RELEASE, run: selectRelease },
  { name: AWAIT_RELEASE_APPROVAL, run: awaitReleaseApproval },
  { name: DOWNLOAD, run: download },
  { name: VERIFY_DOWNLOAD, run: verifyDownload },
  { name: VIRUS_SCAN, run: virusScan },
  { name: EXTRACT_ARCHIVE, run: extractArchive },
  { name: VALIDATE_MEDIA, run: validateMedia },
  { name: IDENTIFY_MEDIA, run: identifyMedia },
  { name: FETCH_METADATA, run: fetchMetadata },
  { name: AWAIT_FINAL_APPROVAL, run: awaitFinalApproval },
  { name: RENAME_FILES, run: renameFiles },
  { name: ORGANIZE_LIBRARY, run: organizeLibrary },
  { name: GENERATE_ARTWORK, run: generateArtwork },
  { name: UPDATE_JELLYFIN, run: updateJellyfin },
  { name: SEND_NOTIFICATIONS, run: sendNotifications },
  { name: LOG_COMPLETION, run: logCompletion },
  { name: ARCHIVE_HISTORY, run: archiveHistory },
];

const HOLD_STATUSES = new Set(["awaiting_release_approval", "awaiting_final_approval"]);

/** The stage immediately after the named one, if any — used when an admin approves a gate to
 * know where the resumed run should pick up. */
export function stageAfter(name: string): string | undefined {
  const index = STAGES.findIndex((s) => s.name === name);
  return index >= 0 && index + 1 < STAGES.length ? STAGES[index + 1]!.name : undefined;
}

/** Rebuilds the in-memory PipelineState a resumed run needs from durable job-row data, rather
 * than persisting/restoring the whole state object. Ephemeral fields (tempDir, downloadProvider,
 * mediaFiles, etc.) aren't needed here — the stage each resume point starts at either derives
 * them itself (e.g. download.ts re-looks-up the provider) or doesn't need them at all. */
function hydrateState(job: Job): PipelineState {
  const state: PipelineState = {};
  if (job.selectedRelease) {
    state.selectedRelease = job.selectedRelease;
    state.parsedRelease = parseReleaseName(job.selectedRelease.title);
  }
  if (job.metadata) {
    state.metadata = job.metadata;
  }
  if (job.primaryMediaFile) {
    state.primaryMediaFile = job.primaryMediaFile;
  }
  if (job.mediaFiles) {
    state.mediaFiles = job.mediaFiles;
  }
  return state;
}

export async function runPipeline(app: AppContext, job: Job): Promise<void> {
  const startIndex = Math.max(0, STAGES.findIndex((s) => s.name === job.stage));
  const isResuming = startIndex > 0;
  const ctx: PipelineContext = { app, job, state: isResuming ? hydrateState(job) : {} };

  try {
    for (const stage of STAGES.slice(startIndex)) {
      await stage.run(ctx);

      // A gate stage may have just paused the job for admin review — stop here, not an error.
      const current = app.queue.getJob(job.id);
      if (current && HOLD_STATUSES.has(current.status)) {
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await app.notifications.dispatch({
      type: "processing.failed",
      title: "Processing failed",
      message: `${job.title}: ${message}`,
      jobId: job.id,
    });
    throw err;
  }
}
