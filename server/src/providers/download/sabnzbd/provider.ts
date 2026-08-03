import type {
  DownloadProvider,
  DownloadStatus,
  ReleaseCandidate,
  SearchQuery,
} from "../types.js";
import { SabnzbdClient } from "./client.js";
import type { SabnzbdConfig } from "./client.js";
import { NewznabClient } from "./newznabClient.js";
import type { NewznabConfig } from "./newznabClient.js";

const QUEUE_STATUS_MAP: Record<string, DownloadStatus["state"]> = {
  Paused: "paused",
  Queued: "queued",
};

export class SabnzbdProvider implements DownloadProvider {
  readonly id = "sabnzbd";
  readonly displayName = "SABnzbd (Usenet)";
  private readonly client: SabnzbdClient | undefined;
  private readonly newznab: NewznabClient | undefined;

  constructor(sabConfig: SabnzbdConfig | undefined, newznabConfig: NewznabConfig | undefined) {
    this.client = sabConfig ? new SabnzbdClient(sabConfig) : undefined;
    this.newznab = newznabConfig ? new NewznabClient(newznabConfig) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): SabnzbdClient {
    if (!this.client) {
      throw new Error("SABnzbd provider is not configured (missing SABNZBD_URL / SABNZBD_API_KEY)");
    }
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    return this.client ? this.client.testConnection() : false;
  }

  async search(query: SearchQuery): Promise<ReleaseCandidate[]> {
    if (!this.newznab) {
      throw new Error(
        "No Newznab-compatible indexer is configured (NEWZNAB_URL / NEWZNAB_API_KEY) — SABnzbd " +
          "itself has no search API, it only downloads NZBs an indexer points it at.",
      );
    }
    const results = await this.newznab.search(query.query);
    return results.map((r) => ({
      id: r.downloadUrl,
      title: r.title,
      sizeBytes: r.sizeBytes,
      // Newznab doesn't expose seeder-style popularity; treat every result as equally
      // trustworthy and let the pipeline's release-name quality parsing do the ranking.
      qualityScore: 0.5,
      providerId: this.id,
    }));
  }

  /** SABnzbd has no per-job destination folder for URL adds — destinationDir is accepted to
   * satisfy the interface but ignored; see SabnzbdClient.addUrl. */
  async addDownload(release: ReleaseCandidate, _destinationDir: string): Promise<string> {
    const client = this.requireClient();
    return client.addUrl(release.id, release.title);
  }

  async getStatus(downloadRef: string): Promise<DownloadStatus> {
    const client = this.requireClient();

    const queue = await client.getQueue();
    const queueSlot = queue.queue.slots.find((s) => s.nzo_id === downloadRef);
    if (queueSlot) {
      const state = QUEUE_STATUS_MAP[queueSlot.status] ?? "downloading";
      const kbPerSec = Number(queue.queue.kbpersec) || 0;
      return {
        state,
        progress: Math.max(0, Math.min(1, Number(queueSlot.percentage) / 100)),
        downloadSpeedBytesPerSec: state === "downloading" ? kbPerSec * 1024 : 0,
        savePath: null,
      };
    }

    const history = await client.getHistory();
    const historySlot = history.history.slots.find((s) => s.nzo_id === downloadRef);
    if (historySlot) {
      if (historySlot.status === "Completed") {
        return { state: "completed", progress: 1, downloadSpeedBytesPerSec: 0, savePath: historySlot.storage };
      }
      if (historySlot.status === "Failed") {
        return {
          state: "error",
          progress: 0,
          downloadSpeedBytesPerSec: 0,
          savePath: null,
          errorMessage: historySlot.fail_message || "SABnzbd reported the download as failed",
        };
      }
    }

    return { state: "unknown", progress: 0, downloadSpeedBytesPerSec: 0, savePath: null };
  }

  async cancel(downloadRef: string): Promise<void> {
    const client = this.requireClient();
    await client.deleteFromQueue(downloadRef, true);
  }
}
