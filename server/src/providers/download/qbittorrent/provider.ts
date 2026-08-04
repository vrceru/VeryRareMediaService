import type {
  DownloadProvider,
  DownloadStatus,
  ReleaseCandidate,
  SearchQuery,
} from "../types.js";
import { QbittorrentClient } from "./client.js";
import type { QbittorrentConfig } from "./client.js";

const STATE_MAP: Record<string, DownloadStatus["state"]> = {
  downloading: "downloading",
  metaDL: "downloading",
  forcedDL: "downloading",
  stalledDL: "downloading",
  queuedDL: "queued",
  allocating: "queued",
  uploading: "completed",
  stalledUP: "completed",
  forcedUP: "completed",
  queuedUP: "completed",
  pausedUP: "completed",
  pausedDL: "paused",
  error: "error",
  missingFiles: "error",
};

/** Extracts the BitTorrent info-hash from a magnet URI so we have a stable download reference. */
function extractHashFromMagnet(magnet: string): string | undefined {
  const match = /xt=urn:btih:([a-zA-Z0-9]+)/.exec(magnet);
  return match?.[1]?.toLowerCase();
}

export class QbittorrentProvider implements DownloadProvider {
  readonly id = "qbittorrent";
  readonly displayName = "qBittorrent";
  private readonly client: QbittorrentClient | undefined;

  constructor(config: QbittorrentConfig | undefined) {
    this.client = config ? new QbittorrentClient(config) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): QbittorrentClient {
    if (!this.client) {
      throw new Error("qBittorrent provider is not configured (missing QBITTORRENT_* env vars)");
    }
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    return this.client ? this.client.testConnection() : false;
  }

  async search(query: SearchQuery): Promise<ReleaseCandidate[]> {
    const client = this.requireClient();
    const results = await client.search(query.query);
    return results
      .map((r): ReleaseCandidate | undefined => {
        const hash = extractHashFromMagnet(r.fileUrl);
        if (!hash) return undefined;
        const seeders = Math.max(r.nbSeeders, 0);
        // Heuristic score: seeders dominate, normalized to keep in a sane 0-1-ish range.
        const qualityScore = seeders / (seeders + 10);
        return {
          id: r.fileUrl,
          title: r.fileName,
          sizeBytes: r.fileSize,
          seeders: r.nbSeeders,
          leechers: r.nbLeechers,
          qualityScore,
          providerId: this.id,
        };
      })
      .filter((r): r is ReleaseCandidate => r !== undefined);
  }

  async addDownload(release: ReleaseCandidate, destinationDir: string): Promise<string> {
    const client = this.requireClient();
    const hash = extractHashFromMagnet(release.id);
    if (!hash) {
      throw new Error("Only magnet-link releases are supported by the qBittorrent provider");
    }
    await client.addTorrent(release.id, destinationDir);
    return hash;
  }

  async getStatus(downloadRef: string): Promise<DownloadStatus> {
    const client = this.requireClient();
    const info = await client.getTorrentInfo(downloadRef);
    if (!info) {
      return { state: "unknown", progress: 0, downloadSpeedBytesPerSec: 0, savePath: null };
    }
    return {
      state: STATE_MAP[info.state] ?? "unknown",
      progress: info.progress,
      downloadSpeedBytesPerSec: info.dlspeed,
      savePath: info.save_path || null,
      connectedPeers: (info.num_seeds ?? 0) + (info.num_leechs ?? 0),
      ...(info.state === "error" || info.state === "missingFiles"
        ? { errorMessage: `qBittorrent reported state: ${info.state}` }
        : {}),
    };
  }

  async cancel(downloadRef: string): Promise<void> {
    const client = this.requireClient();
    await client.deleteTorrent(downloadRef, true);
  }
}
