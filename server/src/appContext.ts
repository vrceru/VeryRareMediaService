import type { AppConfig } from "./config/index.js";
import type { Db } from "./db/client.js";
import { QueueService } from "./queue/queueService.js";
import { DownloadProviderRegistry } from "./providers/download/registry.js";
import { MetadataProviderRegistry } from "./providers/metadata/registry.js";
import { JellyfinClient } from "./integrations/jellyfin/client.js";
import { NotificationDispatcher } from "./integrations/notifications/dispatcher.js";
import { ClamavScanner } from "./services/virusscan/clamavScanner.js";
import type { VirusScanner } from "./services/virusscan/types.js";
import { getLogger } from "./logging/logger.js";
import type { Logger } from "./logging/logger.js";

export interface AppContext {
  config: AppConfig;
  db: Db;
  queue: QueueService;
  downloadProviders: DownloadProviderRegistry;
  metadataProviders: MetadataProviderRegistry;
  jellyfin: JellyfinClient | undefined;
  notifications: NotificationDispatcher;
  virusScanner: VirusScanner;
  logger: Logger;
}

export function createAppContext(config: AppConfig, db: Db): AppContext {
  return {
    config,
    db,
    queue: new QueueService(db, {
      maxRetries: config.queue.maxRetries,
      retryBackoffMs: config.queue.retryBackoffMs,
    }),
    downloadProviders: new DownloadProviderRegistry(config),
    metadataProviders: new MetadataProviderRegistry(config),
    jellyfin: config.jellyfin ? new JellyfinClient(config.jellyfin) : undefined,
    notifications: new NotificationDispatcher(config),
    virusScanner: new ClamavScanner({
      enabled: config.virusScan.enabled,
      host: config.virusScan.clamdHost,
      port: config.virusScan.clamdPort,
    }),
    logger: getLogger("app"),
  };
}
