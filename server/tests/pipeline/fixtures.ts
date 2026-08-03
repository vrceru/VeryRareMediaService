import { loadConfig } from "../../src/config/index.js";
import { createDb } from "../../src/db/client.js";
import type { Db } from "../../src/db/client.js";
import { QueueService } from "../../src/queue/queueService.js";
import type { Job, MediaRequest } from "../../src/queue/types.js";
import type { AppContext } from "../../src/appContext.js";
import type { DownloadProviderRegistry } from "../../src/providers/download/registry.js";
import type { MetadataProviderRegistry } from "../../src/providers/metadata/registry.js";
import type {
  DownloadProvider,
  DownloadStatus,
  ReleaseCandidate,
  SearchQuery,
} from "../../src/providers/download/types.js";
import type {
  MediaMetadata,
  MetadataLookupOptions,
  MetadataProvider,
  MetadataSearchResult,
} from "../../src/providers/metadata/types.js";
import type { MediaType } from "../../src/db/schema.js";
import { NotificationDispatcher } from "../../src/integrations/notifications/dispatcher.js";
import { ClamavScanner } from "../../src/services/virusscan/clamavScanner.js";
import type { VirusScanner } from "../../src/services/virusscan/types.js";
import { getLogger } from "../../src/logging/logger.js";
import type { PipelineContext, PipelineState } from "../../src/pipeline/types.js";
import type { JellyfinClient } from "../../src/integrations/jellyfin/client.js";

export class FakeDownloadProvider implements DownloadProvider {
  readonly id = "fake-download";
  readonly displayName = "Fake Download";
  configured = true;
  searchResults: ReleaseCandidate[] = [];
  statusSequence: DownloadStatus[] = [];
  addedRefs: string[] = [];
  cancelledRefs: string[] = [];
  private statusIndex = 0;

  isConfigured(): boolean {
    return this.configured;
  }
  async search(_query: SearchQuery): Promise<ReleaseCandidate[]> {
    return this.searchResults;
  }
  async addDownload(release: ReleaseCandidate, _destinationDir: string): Promise<string> {
    const ref = `ref-${release.id}`;
    this.addedRefs.push(ref);
    return ref;
  }
  async getStatus(_downloadRef: string): Promise<DownloadStatus> {
    const status = this.statusSequence[Math.min(this.statusIndex, this.statusSequence.length - 1)];
    this.statusIndex++;
    return status ?? { state: "unknown", progress: 0, downloadSpeedBytesPerSec: 0, savePath: null };
  }
  async cancel(downloadRef: string): Promise<void> {
    this.cancelledRefs.push(downloadRef);
  }
}

export class FakeMetadataProvider implements MetadataProvider {
  readonly id: string;
  configured = true;
  searchResults: MetadataSearchResult[] = [];
  details: MediaMetadata | undefined;

  constructor(readonly mediaType: MediaType) {
    this.id = `fake-${mediaType}`;
  }
  isConfigured(): boolean {
    return this.configured;
  }
  async search(_query: string, _year?: number): Promise<MetadataSearchResult[]> {
    return this.searchResults;
  }
  async getDetails(_externalId: string, options?: MetadataLookupOptions): Promise<MediaMetadata> {
    if (!this.details) throw new Error("FakeMetadataProvider: no details configured");
    return {
      ...this.details,
      ...(options?.season !== undefined ? { season: options.season } : {}),
      ...(options?.episode !== undefined ? { episode: options.episode } : {}),
    };
  }
}

export interface TestAppContextOptions {
  downloadProvider?: DownloadProvider;
  metadataProvider?: MetadataProvider;
  jellyfin?: JellyfinClient;
  virusScanner?: VirusScanner;
  downloadTempDir?: string;
  libraryDirs?: { movie: string; show: string; anime: string; music: string };
}

export interface TestApp {
  app: AppContext;
  queue: QueueService;
  db: Db;
}

/** Builds a fully working AppContext against an in-memory DB, with fake/no-op providers by
 * default so stage tests never touch the network or a real filesystem unless a test opts in
 * via overrides. */
export function createTestApp(overrides: TestAppContextOptions = {}): TestApp {
  const config = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:" } as NodeJS.ProcessEnv);
  if (overrides.downloadTempDir) config.storage.downloadTempDir = overrides.downloadTempDir;
  if (overrides.libraryDirs) config.storage.libraryDirs = overrides.libraryDirs;

  const db = createDb(":memory:");
  const queue = new QueueService(db, {
    maxRetries: config.queue.maxRetries,
    retryBackoffMs: config.queue.retryBackoffMs,
  });

  const downloadProviders = {
    get: (id: string) => (overrides.downloadProvider?.id === id ? overrides.downloadProvider : undefined),
    list: () => (overrides.downloadProvider ? [overrides.downloadProvider] : []),
    listConfigured: () =>
      overrides.downloadProvider?.isConfigured() ? [overrides.downloadProvider] : [],
  } as unknown as DownloadProviderRegistry;

  const metadataProviders = {
    get: (mediaType: MediaType) => {
      if (overrides.metadataProvider && overrides.metadataProvider.mediaType === mediaType) {
        return overrides.metadataProvider;
      }
      throw new Error(`no fake metadata provider registered for media type "${mediaType}"`);
    },
    list: () => (overrides.metadataProvider ? [overrides.metadataProvider] : []),
  } as unknown as MetadataProviderRegistry;

  const app: AppContext = {
    config,
    db,
    queue,
    downloadProviders,
    metadataProviders,
    jellyfin: overrides.jellyfin,
    notifications: new NotificationDispatcher(config),
    virusScanner: overrides.virusScanner ?? new ClamavScanner({ enabled: false, host: "localhost", port: 3310 }),
    logger: getLogger("test"),
  };

  return { app, queue, db };
}

/** Enqueues a request and immediately claims it, so it's in the "running" state most stages
 * assume they're operating on. */
export function createRunningJob(queue: QueueService, request: MediaRequest): Job {
  queue.enqueue(request);
  return queue.claimNext()!;
}

export function makeContext(app: AppContext, job: Job, state: Partial<PipelineState> = {}): PipelineContext {
  return { app, job, state };
}
