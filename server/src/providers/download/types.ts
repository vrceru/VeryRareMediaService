export interface SearchQuery {
  query: string;
  /** Free-form category hint (e.g. "movie", "show", "anime", "music") — providers may ignore it. */
  category?: string;
}

export interface ReleaseCandidate {
  /** Provider-specific identifier needed to start the download (magnet URI, NZB URL, etc.) */
  id: string;
  title: string;
  sizeBytes: number;
  seeders?: number;
  leechers?: number;
  /** 0-1 provider-side heuristic (e.g. seeder count), higher is better. Blended with the
   * parsed release's technical quality and request relevance in the select-release stage —
   * see services/releaseParsing. */
  qualityScore: number;
  providerId: string;
}

export type DownloadState =
  | "queued"
  | "downloading"
  | "completed"
  | "error"
  | "paused"
  | "unknown";

export interface DownloadStatus {
  state: DownloadState;
  progress: number;
  downloadSpeedBytesPerSec: number;
  savePath: string | null;
  errorMessage?: string;
  /** Peers the client is actually connected to right now (not the search index's advertised
   * seeder count, which can be stale or outright fake). Providers that can't report this leave
   * it undefined; download.ts treats that as "assume healthy" rather than bailing early. */
  connectedPeers?: number;
}

/**
 * Common interface every download backend (torrent client, usenet client, direct HTTP
 * downloader) must implement so the pipeline can treat them interchangeably.
 */
export interface DownloadProvider {
  readonly id: string;
  readonly displayName: string;

  isConfigured(): boolean;
  search(query: SearchQuery): Promise<ReleaseCandidate[]>;
  addDownload(release: ReleaseCandidate, destinationDir: string): Promise<string>;
  getStatus(downloadRef: string): Promise<DownloadStatus>;
  cancel(downloadRef: string): Promise<void>;
}
