import type { AppContext } from "../../appContext.js";
import { YtDlpClient } from "../../providers/download/youtube/client.js";
import { parseYoutubeUrl, isPlaylistUrl } from "../../providers/download/youtube/urlValidation.js";
import { IngestionTracker } from "./ingestionTracker.js";
import { PlaylistRunTracker } from "./playlistRuns.js";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("youtube-ingestion");

export class YoutubeIngestionDisabledError extends Error {
  constructor() {
    super("YouTube ingestion is disabled — set YOUTUBE_INGESTION_ENABLED=true");
  }
}

export interface IngestPlaylistResult {
  runId: string;
  playlistId?: string;
  playlistTitle?: string;
  discovered: number;
  enqueued: number;
  skippedDuplicate: number;
  failed: number;
  jobIds: string[];
  /** Same jobs as jobIds, paired with their track title -- lets a caller (e.g. the Discord bot)
   * create its own per-job tracking record without a redundant lookup back into VRMS. */
  jobs: { id: string; title: string }[];
  failures: { videoId: string; title: string; reason: string }[];
  /** Should always be empty — every discovered track must land in enqueued/skipped/failed.
   * A non-empty list means the accounting itself has a bug and a track was silently dropped;
   * surfaced here rather than hidden, per the "make sure nothing comes up missing" requirement. */
  unaccountedFor: string[];
}

function requireYtDlpClient(app: AppContext): YtDlpClient {
  if (!app.config.youtube) throw new YoutubeIngestionDisabledError();
  return new YtDlpClient({ binaryPath: app.config.youtube.binaryPath, audioFormat: app.config.youtube.audioFormat });
}

/**
 * Resolves a YouTube playlist and enqueues one VRMS job per track not already ingested, reusing
 * the existing QueueService.enqueue() — no parallel job-creation path. One track's failure
 * doesn't stop the rest; every discovered track is accounted for in exactly one of
 * enqueued/skippedDuplicate/failed (checked explicitly at the end, see `unaccountedFor`).
 */
export async function ingestPlaylist(app: AppContext, playlistUrl: string): Promise<IngestPlaylistResult> {
  const client = requireYtDlpClient(app);
  const url = parseYoutubeUrl(playlistUrl);
  if (!isPlaylistUrl(url)) {
    throw new Error(`"${playlistUrl}" is not a YouTube playlist URL`);
  }

  const tracker = new IngestionTracker(app.db);
  const runs = new PlaylistRunTracker(app.db);
  const runId = runs.start(playlistUrl);

  const playlist = await client.resolvePlaylist(playlistUrl);
  const discoveredIds = new Set(playlist.tracks.map((t) => t.videoId));

  const jobIds: string[] = [];
  const jobs: { id: string; title: string }[] = [];
  const failures: { videoId: string; title: string; reason: string }[] = [];
  let skippedDuplicate = 0;
  const accountedFor = new Set<string>();

  for (const track of playlist.tracks) {
    try {
      if (tracker.isIngested(track.videoId)) {
        skippedDuplicate++;
        accountedFor.add(track.videoId);
        continue;
      }

      const job = app.queue.enqueue({
        title: track.title,
        mediaType: "music",
        searchQuery: track.url,
        preferredProviderId: "youtube",
        ...(track.durationSeconds !== undefined ? { durationSeconds: track.durationSeconds } : {}),
      });
      tracker.record(track.videoId, playlist.playlistId, job.id);
      jobIds.push(job.id);
      jobs.push({ id: job.id, title: track.title });
      accountedFor.add(track.videoId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.warn({ videoId: track.videoId, title: track.title, reason }, "failed to ingest playlist track");
      failures.push({ videoId: track.videoId, title: track.title, reason });
      accountedFor.add(track.videoId);
    }
  }

  const unaccountedFor = [...discoveredIds].filter((id) => !accountedFor.has(id));
  if (unaccountedFor.length > 0) {
    log.error({ runId, unaccountedFor }, "playlist ingestion accounting mismatch — tracks went unaccounted for");
  }

  runs.finish(runId, {
    ...(playlist.playlistTitle ? { playlistTitle: playlist.playlistTitle } : {}),
    discovered: playlist.tracks.length,
    enqueued: jobIds.length,
    skippedDuplicate,
    failed: failures.length,
    jobIds,
  });

  return {
    runId,
    ...(playlist.playlistId ? { playlistId: playlist.playlistId } : {}),
    ...(playlist.playlistTitle ? { playlistTitle: playlist.playlistTitle } : {}),
    discovered: playlist.tracks.length,
    enqueued: jobIds.length,
    skippedDuplicate,
    failed: failures.length,
    jobIds,
    jobs,
    failures,
    unaccountedFor,
  };
}
