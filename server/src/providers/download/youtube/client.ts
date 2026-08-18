import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class YtDlpError extends Error {}

export interface YtDlpConfig {
  binaryPath: string;
  /** Passed to `--audio-format`. "best" keeps the native codec (no forced re-encode). */
  audioFormat: string;
}

export interface PlaylistTrackSummary {
  videoId: string;
  title: string;
  uploader?: string;
  durationSeconds?: number;
  url: string;
}

export interface PlaylistSummary {
  playlistId?: string;
  playlistTitle?: string;
  tracks: PlaylistTrackSummary[];
}

/** Thin wrapper around shelling out to the yt-dlp binary — the first external-process
 * dependency in VRMS (everything else talks HTTP or raw TCP). Requires `yt-dlp` (and
 * `ffmpeg`, which `-x` needs for audio extraction) on PATH or pointed at via config. */
export class YtDlpClient {
  constructor(private readonly config: YtDlpConfig) {}

  /** Lists a playlist's tracks without downloading anything. */
  async resolvePlaylist(playlistUrl: string): Promise<PlaylistSummary> {
    let stdout: string;
    try {
      const result = await execFileAsync(
        this.config.binaryPath,
        ["--flat-playlist", "--dump-json", "--no-warnings", playlistUrl],
        { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
      );
      stdout = result.stdout;
    } catch (err) {
      throw new YtDlpError(`yt-dlp failed to resolve playlist: ${err instanceof Error ? err.message : String(err)}`);
    }

    const tracks: PlaylistTrackSummary[] = [];
    let playlistId: string | undefined;
    let playlistTitle: string | undefined;

    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      const videoId = typeof entry.id === "string" ? entry.id : undefined;
      if (!videoId) continue;

      playlistId ??= typeof entry.playlist_id === "string" ? entry.playlist_id : undefined;
      playlistTitle ??= typeof entry.playlist_title === "string" ? entry.playlist_title : undefined;

      tracks.push({
        videoId,
        title: typeof entry.title === "string" ? entry.title : videoId,
        ...(typeof entry.uploader === "string" ? { uploader: entry.uploader } : {}),
        ...(typeof entry.duration === "number" ? { durationSeconds: entry.duration } : {}),
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    if (tracks.length === 0) {
      throw new YtDlpError("yt-dlp returned no tracks for this playlist");
    }

    return { ...(playlistId ? { playlistId } : {}), ...(playlistTitle ? { playlistTitle } : {}), tracks };
  }

  /** Starts downloading+extracting one video's audio into destDir. Returns the raw child
   * process — the caller (provider.ts) owns progress tracking and lifecycle, same split of
   * responsibility as qbittorrent/client.ts (raw calls) vs. qbittorrent/provider.ts (state). */
  spawnDownload(videoUrl: string, destDir: string): ChildProcess {
    const args = [
      "-x",
      "--audio-format",
      this.config.audioFormat,
      "--newline",
      "--no-warnings",
      "-o",
      `${destDir}/%(id)s.%(ext)s`,
      videoUrl,
    ];
    return spawn(this.config.binaryPath, args);
  }
}
