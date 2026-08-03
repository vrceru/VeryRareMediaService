import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  DownloadProvider,
  DownloadState,
  DownloadStatus,
  ReleaseCandidate,
  SearchQuery,
} from "../types.js";
import { assertPublicHttpUrl } from "../../../security/ssrfGuard.js";
import { sanitizeFilename } from "../../../security/filenameSanitizer.js";
import { getLogger } from "../../../logging/logger.js";

const log = getLogger("direct-download");

const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 2000;

interface DownloadRecord {
  url: string;
  filePath: string;
  state: DownloadState;
  bytesReceived: number;
  totalBytes?: number;
  error?: string;
  controller: AbortController;
  startedAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Downloads a direct HTTP(S) URL to disk itself, in-process — unlike qBittorrent/SABnzbd there's
 * no external daemon to hand the job to, so this provider streams the response, tracks progress
 * in memory, and resumes via HTTP Range requests if the connection drops mid-transfer.
 *
 * Limitations (by design, not oversight): progress tracking is in-memory only, so a server
 * restart loses it — the queue's normal retry logic will simply restart the download from
 * scratch as a new attempt. Resume only covers a dropped connection within the same run; it
 * does not persist across process restarts.
 */
export class DirectDownloadProvider implements DownloadProvider {
  readonly id = "direct-download";
  readonly displayName = "Direct Download";
  private readonly downloads = new Map<string, DownloadRecord>();

  isConfigured(): boolean {
    return true;
  }

  /** There's no generic "search" for arbitrary direct-download sources — if the query is
   * itself a URL, treat it as the one candidate; otherwise there's nothing to return. */
  async search(query: SearchQuery): Promise<ReleaseCandidate[]> {
    const url = tryParseUrl(query.query);
    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return [];

    const title = basename(url.pathname) || url.hostname;
    return [
      {
        id: url.toString(),
        title,
        sizeBytes: 0,
        qualityScore: 0.5,
        providerId: this.id,
      },
    ];
  }

  async addDownload(release: ReleaseCandidate, destinationDir: string): Promise<string> {
    const url = tryParseUrl(release.id);
    if (!url) {
      throw new Error(`Direct download provider requires a valid URL, got "${release.id}"`);
    }
    await assertPublicHttpUrl(url);

    await mkdir(destinationDir, { recursive: true });
    const filename = sanitizeFilename(basename(url.pathname) || "download.bin");
    const filePath = join(destinationDir, filename);

    const ref = randomUUID();
    const record: DownloadRecord = {
      url: url.toString(),
      filePath,
      state: "downloading",
      bytesReceived: 0,
      controller: new AbortController(),
      startedAt: Date.now(),
    };
    this.downloads.set(ref, record);

    // Runs in the background; getStatus()/cancel() interact with `record` while this proceeds.
    this.runWithRetries(record).catch((err) => {
      record.state = "error";
      record.error = err instanceof Error ? err.message : String(err);
      log.error({ ref, url: record.url, err: record.error }, "direct download failed permanently");
    });

    return ref;
  }

  private async runWithRetries(record: DownloadRecord): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.attempt(record);
        record.state = "completed";
        return;
      } catch (err) {
        if (record.controller.signal.aborted) {
          record.state = "error";
          record.error = "Download cancelled";
          return;
        }
        if (attempt >= MAX_ATTEMPTS) {
          throw err;
        }
        log.warn(
          { url: record.url, attempt, bytesReceived: record.bytesReceived, err: err instanceof Error ? err.message : err },
          "direct download interrupted, resuming",
        );
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  /** One connection attempt. Resumes from record.bytesReceived via a Range header when
   * retrying after a previous attempt made partial progress. */
  private async attempt(record: DownloadRecord): Promise<void> {
    const headers: Record<string, string> = {};
    if (record.bytesReceived > 0) {
      headers.Range = `bytes=${record.bytesReceived}-`;
    }

    const res = await fetch(record.url, { signal: record.controller.signal, headers });
    if (!res.ok && res.status !== 206) {
      throw new Error(`Direct download failed: HTTP ${res.status}`);
    }

    const serverHonoredRange = res.status === 206;
    if (record.bytesReceived > 0 && !serverHonoredRange) {
      // Server doesn't support Range requests — only option is to restart from scratch.
      record.bytesReceived = 0;
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      record.totalBytes = record.bytesReceived + Number(contentLength);
    }

    const body = res.body;
    if (!body) throw new Error("Direct download response had no body");

    const fileHandle = await open(record.filePath, record.bytesReceived > 0 ? "a" : "w");
    try {
      for await (const chunk of body) {
        const buf = Buffer.from(chunk as Uint8Array);
        await fileHandle.write(buf);
        record.bytesReceived += buf.byteLength;
      }
    } finally {
      await fileHandle.close();
    }
  }

  async getStatus(downloadRef: string): Promise<DownloadStatus> {
    const record = this.downloads.get(downloadRef);
    if (!record) {
      return { state: "unknown", progress: 0, downloadSpeedBytesPerSec: 0, savePath: null };
    }

    const progress = record.totalBytes
      ? Math.max(0, Math.min(1, record.bytesReceived / record.totalBytes))
      : record.state === "completed"
        ? 1
        : 0;

    const elapsedSec = (Date.now() - record.startedAt) / 1000;
    const downloadSpeedBytesPerSec =
      record.state === "downloading" && elapsedSec > 0 ? record.bytesReceived / elapsedSec : 0;

    return {
      state: record.state,
      progress,
      downloadSpeedBytesPerSec,
      savePath: record.state === "completed" ? dirname(record.filePath) : null,
      ...(record.state === "error" && record.error ? { errorMessage: record.error } : {}),
    };
  }

  async cancel(downloadRef: string): Promise<void> {
    const record = this.downloads.get(downloadRef);
    if (!record) return;
    record.controller.abort();
  }
}
