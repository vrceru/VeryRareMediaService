import { envSchema } from "./schema.js";
import type { Env } from "./schema.js";

export interface AppConfig {
  server: { port: number; host: string; nodeEnv: Env["NODE_ENV"]; apiKey?: string };
  logging: { level: Env["LOG_LEVEL"]; pretty: boolean };
  database: { path: string };
  storage: {
    downloadTempDir: string;
    libraryDirs: {
      movie: string;
      show: string;
      anime: string;
      music: string;
    };
  };
  queue: {
    concurrency: number;
    pollIntervalMs: number;
    maxRetries: number;
    retryBackoffMs: number;
  };
  qbittorrent?: { url: string; username: string; password: string };
  sabnzbd?: { url: string; apiKey: string };
  newznab?: { url: string; apiKey: string };
  tmdb?: { apiKey: string };
  jellyfin?: { url: string; apiKey: string };
  discord?: { webhookUrl: string };
  webhookUrls: string[];
  virusScan: { enabled: boolean; clamdHost: string; clamdPort: number };
  naming: {
    movie: string;
    show: string;
    anime: string;
    music: string;
  };
}

export class ConfigError extends Error {}

/**
 * Loads and validates configuration from environment variables. Throws ConfigError with a
 * readable message on malformed values. Missing optional integrations (qBittorrent, TMDB,
 * Jellyfin, Discord) are left undefined rather than defaulted — callers must check presence
 * before use, and the service logs which integrations are inactive at boot.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(`Invalid configuration:\n${issues}`);
  }
  const e = parsed.data;

  const qbittorrent =
    e.QBITTORRENT_URL && e.QBITTORRENT_USERNAME && e.QBITTORRENT_PASSWORD
      ? { url: e.QBITTORRENT_URL, username: e.QBITTORRENT_USERNAME, password: e.QBITTORRENT_PASSWORD }
      : undefined;

  const sabnzbd =
    e.SABNZBD_URL && e.SABNZBD_API_KEY ? { url: e.SABNZBD_URL, apiKey: e.SABNZBD_API_KEY } : undefined;

  const newznab =
    e.NEWZNAB_URL && e.NEWZNAB_API_KEY ? { url: e.NEWZNAB_URL, apiKey: e.NEWZNAB_API_KEY } : undefined;

  const tmdb = e.TMDB_API_KEY ? { apiKey: e.TMDB_API_KEY } : undefined;

  const jellyfin =
    e.JELLYFIN_URL && e.JELLYFIN_API_KEY ? { url: e.JELLYFIN_URL, apiKey: e.JELLYFIN_API_KEY } : undefined;

  const discord = e.DISCORD_WEBHOOK_URL ? { webhookUrl: e.DISCORD_WEBHOOK_URL } : undefined;

  const webhookUrls = (e.NOTIFICATION_WEBHOOK_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return {
    server: { port: e.PORT, host: e.HOST, nodeEnv: e.NODE_ENV, ...(e.API_KEY ? { apiKey: e.API_KEY } : {}) },
    logging: { level: e.LOG_LEVEL, pretty: e.NODE_ENV !== "production" },
    database: { path: e.DATABASE_PATH },
    storage: {
      downloadTempDir: e.DOWNLOAD_TEMP_DIR,
      libraryDirs: {
        movie: e.LIBRARY_MOVIES_DIR,
        show: e.LIBRARY_SHOWS_DIR,
        anime: e.LIBRARY_ANIME_DIR,
        music: e.LIBRARY_MUSIC_DIR,
      },
    },
    queue: {
      concurrency: e.QUEUE_CONCURRENCY,
      pollIntervalMs: e.QUEUE_POLL_INTERVAL_MS,
      maxRetries: e.QUEUE_MAX_RETRIES,
      retryBackoffMs: e.QUEUE_RETRY_BACKOFF_MS,
    },
    ...(qbittorrent ? { qbittorrent } : {}),
    ...(sabnzbd ? { sabnzbd } : {}),
    ...(newznab ? { newznab } : {}),
    ...(tmdb ? { tmdb } : {}),
    ...(jellyfin ? { jellyfin } : {}),
    ...(discord ? { discord } : {}),
    webhookUrls,
    virusScan: {
      enabled: e.VIRUS_SCAN_ENABLED,
      clamdHost: e.CLAMD_HOST,
      clamdPort: e.CLAMD_PORT,
    },
    naming: {
      movie: e.NAMING_TEMPLATE_MOVIE,
      show: e.NAMING_TEMPLATE_SHOW,
      anime: e.NAMING_TEMPLATE_ANIME,
      music: e.NAMING_TEMPLATE_MUSIC,
    },
  };
}

/** Logs which optional integrations are active/inactive. Call once at boot. */
export function describeIntegrations(config: AppConfig): string[] {
  const lines: string[] = [];
  lines.push(`qBittorrent: ${config.qbittorrent ? "configured" : "not configured"}`);
  lines.push(`SABnzbd: ${config.sabnzbd ? "configured" : "not configured"}`);
  lines.push(`Newznab indexer (usenet search): ${config.newznab ? "configured" : "not configured"}`);
  lines.push(`TMDB (movies/TV metadata): ${config.tmdb ? "configured" : "not configured"}`);
  lines.push(`Jellyfin: ${config.jellyfin ? "configured" : "not configured"}`);
  lines.push(`Discord notifications: ${config.discord ? "configured" : "not configured"}`);
  lines.push(`Virus scanning: ${config.virusScan.enabled ? "enabled" : "disabled"}`);
  lines.push(
    config.server.apiKey
      ? "API authentication: enabled"
      : "API authentication: DISABLED — set API_KEY to require it. The API is reachable by " +
          "anyone who can connect to this port until you do.",
  );
  return lines;
}
