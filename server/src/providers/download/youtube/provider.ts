import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { ChildProcess } from "node:child_process";
import type {
  DownloadProvider,
  DownloadState,
  DownloadStatus,
  ReleaseCandidate,
  SearchQuery,
} from "../types.js";
import { YtDlpClient } from "./client.js";
import { parseYoutubeUrl, isVideoUrl, extractVideoId, InvalidYoutubeUrlError } from "./urlValidation.js";
import { getLogger } from "../../../logging/logger.js";

const log = getLogger("youtube");

const PROGRESS_PATTERN = /\[download]\s+(\d+(?:\.\d+)?)%/;

interface DownloadRecord {
  videoUrl: string;
  destinationDir: string;
  state: DownloadState;
  progress: number;
  error?: string;
  child: ChildProcess;
}

export interface YoutubeProviderConfig {
  binaryPath: string;
  audioFormat: string;
}

/**
 * Downloads one YouTube video's audio at a time, in-process — like DirectDownloadProvider,
 * there's no external daemon to hand this to, so progress/state live in memory here.
 *
 * search() deliberately only recognizes a single video URL, never a playlist: a playlist is
 * resolved up front by services/youtube/playlistIngestion.ts, which enqueues one VRMS job per
 * track, each already carrying its own video URL as the request's searchQuery plus
 * preferredProviderId: "youtube" (so searchProviders.ts calls only this provider, not every
 * configured one).
 */
export class YoutubeProvider implements DownloadProvider {
  readonly id = "youtube";
  readonly displayName = "YouTube";
  private readonly client: YtDlpClient | undefined;
  private readonly downloads = new Map<string, DownloadRecord>();

  constructor(config: YoutubeProviderConfig | undefined) {
    this.client = config ? new YtDlpClient(config) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): YtDlpClient {
    if (!this.client) {
      throw new Error("YouTube provider is not configured (set YOUTUBE_INGESTION_ENABLED=true)");
    }
    return this.client;
  }

  async search(query: SearchQuery): Promise<ReleaseCandidate[]> {
    let url: URL;
    try {
      url = parseYoutubeUrl(query.query);
    } catch (err) {
      if (err instanceof InvalidYoutubeUrlError) return [];
      throw err;
    }
    if (!isVideoUrl(url)) return [];

    const videoId = extractVideoId(url);
    if (!videoId) return [];

    return [
      {
        id: url.toString(),
        // The raw YouTube title isn't recoverable from the URL alone; the playlist
        // orchestrator already has it and sets it as the job's title directly when enqueuing —
        // this is only a fallback label for a standalone search() call.
        title: query.query,
        sizeBytes: 0,
        qualityScore: 0.5,
        providerId: this.id,
        dedupeKey: videoId,
      },
    ];
  }

  async addDownload(release: ReleaseCandidate, destinationDir: string): Promise<string> {
    const client = this.requireClient();
    await mkdir(destinationDir, { recursive: true });

    const child = client.spawnDownload(release.id, destinationDir);
    const ref = randomUUID();
    const record: DownloadRecord = {
      videoUrl: release.id,
      destinationDir,
      state: "downloading",
      progress: 0,
      child,
    };
    this.downloads.set(ref, record);

    let tail = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-2000);
      const match = PROGRESS_PATTERN.exec(text);
      if (match) record.progress = Math.max(0, Math.min(1, Number(match[1]) / 100));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-2000);
    });
    child.on("error", (err) => {
      record.state = "error";
      record.error = err.message;
    });
    child.on("close", (code) => {
      if (record.state === "error") return; // a spawn error was already recorded
      if (code === 0) {
        record.state = "completed";
        record.progress = 1;
      } else {
        record.state = "error";
        record.error = tail.trim().split("\n").at(-1) || `yt-dlp exited with code ${code}`;
        log.warn({ videoUrl: release.id, code, error: record.error }, "youtube download failed");
      }
    });

    return ref;
  }

  async getStatus(downloadRef: string): Promise<DownloadStatus> {
    const record = this.downloads.get(downloadRef);
    if (!record) {
      return { state: "unknown", progress: 0, downloadSpeedBytesPerSec: 0, savePath: null };
    }
    return {
      state: record.state,
      progress: record.progress,
      downloadSpeedBytesPerSec: 0,
      savePath: record.state === "completed" ? record.destinationDir : null,
      ...(record.state === "error" && record.error ? { errorMessage: record.error } : {}),
    };
  }

  async cancel(downloadRef: string): Promise<void> {
    const record = this.downloads.get(downloadRef);
    if (!record) return;
    record.child.kill();
  }
}
