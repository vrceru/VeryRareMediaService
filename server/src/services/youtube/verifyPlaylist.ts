import type { AppContext } from "../../appContext.js";
import { YtDlpClient } from "../../providers/download/youtube/client.js";
import { parseYoutubeUrl, isPlaylistUrl } from "../../providers/download/youtube/urlValidation.js";
import { IngestionTracker } from "./ingestionTracker.js";
import { YoutubeIngestionDisabledError } from "./playlistIngestion.js";

export interface PlaylistVerification {
  playlistId?: string;
  playlistTitle?: string;
  liveTrackCount: number;
  ingestedCount: number;
  /** Tracks currently in the live YouTube playlist that have no corresponding
   * youtube_ingested_tracks row — i.e. never successfully turned into a VRMS job. This is the
   * actual "did anything come up missing" answer, independent of any single run's own bookkeeping. */
  missingTracks: { videoId: string; title: string; url: string }[];
  /** Tracks we've recorded as ingested for this playlist that are no longer in the live
   * playlist (removed by the uploader, made private, etc.) — informational, not an error. */
  removedFromPlaylist: string[];
}

/**
 * Re-resolves a playlist live and diffs it against what's actually recorded as ingested,
 * independent of any single ingestPlaylist() run's own accounting. Answers "is anything
 * actually missing right now" rather than "did the last run think it got everything."
 */
export async function verifyPlaylist(app: AppContext, playlistUrl: string): Promise<PlaylistVerification> {
  if (!app.config.youtube) throw new YoutubeIngestionDisabledError();
  const url = parseYoutubeUrl(playlistUrl);
  if (!isPlaylistUrl(url)) {
    throw new Error(`"${playlistUrl}" is not a YouTube playlist URL`);
  }

  const client = new YtDlpClient({
    binaryPath: app.config.youtube.binaryPath,
    audioFormat: app.config.youtube.audioFormat,
  });
  const playlist = await client.resolvePlaylist(playlistUrl);

  const tracker = new IngestionTracker(app.db);
  const ingested = playlist.playlistId ? tracker.listForPlaylist(playlist.playlistId) : [];
  const ingestedIds = new Set(ingested.map((t) => t.videoId));
  const liveIds = new Set(playlist.tracks.map((t) => t.videoId));

  const missingTracks = playlist.tracks
    .filter((t) => !ingestedIds.has(t.videoId))
    .map((t) => ({ videoId: t.videoId, title: t.title, url: t.url }));

  const removedFromPlaylist = ingested.filter((t) => !liveIds.has(t.videoId)).map((t) => t.videoId);

  return {
    ...(playlist.playlistId ? { playlistId: playlist.playlistId } : {}),
    ...(playlist.playlistTitle ? { playlistTitle: playlist.playlistTitle } : {}),
    liveTrackCount: playlist.tracks.length,
    ingestedCount: ingested.length,
    missingTracks,
    removedFromPlaylist,
  };
}
