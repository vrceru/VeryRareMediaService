import { z } from "zod";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

// optionalUrl still rejects a *present but empty* value (e.g. `NEWZNAB_URL=` in
// a .env someone copied from .env.example without filling in) since "" isn't a valid URL and
// isn't undefined either. Treat blank as unset before the URL check runs.
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional());

export const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // If unset, the API runs unauthenticated (a loud warning is logged at boot).
  API_KEY: z.string().min(1).optional(),

  // Database
  DATABASE_PATH: z.string().default("./data/vrms.db"),

  // Storage
  DOWNLOAD_TEMP_DIR: z.string().default("./data/downloads"),
  LIBRARY_MOVIES_DIR: z.string().default("./data/library/movies"),
  LIBRARY_SHOWS_DIR: z.string().default("./data/library/shows"),
  LIBRARY_ANIME_DIR: z.string().default("./data/library/anime"),
  LIBRARY_MUSIC_DIR: z.string().default("./data/library/music"),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  QUEUE_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  QUEUE_RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(30000),

  // qBittorrent
  QBITTORRENT_URL: optionalUrl,
  QBITTORRENT_USERNAME: z.string().optional(),
  QBITTORRENT_PASSWORD: z.string().optional(),

  // SABnzbd (usenet download client)
  SABNZBD_URL: optionalUrl,
  SABNZBD_API_KEY: z.string().optional(),

  // Newznab-compatible indexer (search only — SABnzbd itself has no search API)
  NEWZNAB_URL: optionalUrl,
  NEWZNAB_API_KEY: z.string().optional(),

  // TMDB
  TMDB_API_KEY: z.string().optional(),

  // Jellyfin
  JELLYFIN_URL: optionalUrl,
  JELLYFIN_API_KEY: z.string().optional(),

  // Notifications
  DISCORD_WEBHOOK_URL: optionalUrl,
  // Comma-separated list of generic outgoing webhook URLs (future integrations).
  NOTIFICATION_WEBHOOK_URLS: z.string().optional(),

  // Virus scan
  VIRUS_SCAN_ENABLED: boolFromString,
  CLAMD_HOST: z.string().default("localhost"),
  CLAMD_PORT: z.coerce.number().int().positive().default(3310),

  // Naming templates (optional overrides — see services/naming for token reference)
  NAMING_TEMPLATE_MOVIE: z.string().default("{title} ({year})/{title} ({year}){extension}"),
  NAMING_TEMPLATE_SHOW: z.string().default(
    "{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded} - {episodeTitle}{extension}",
  ),
  NAMING_TEMPLATE_ANIME: z.string().default(
    "{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded}{extension}",
  ),
  NAMING_TEMPLATE_MUSIC: z.string().default("{artist}/{album} ({year})/{trackPadded} - {title}{extension}"),
});

export type Env = z.infer<typeof envSchema>;
