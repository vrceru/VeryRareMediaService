# Environment Variables

Copy `server/.env.example` to `server/.env` and fill in what you use. Nothing is hardcoded —
every secret, path, and server URL comes from these variables, validated at startup by
`src/config/schema.ts` (Zod). Invalid values (e.g. a non-numeric `PORT`) cause the process to
print a readable error and exit rather than start in a broken state.

Every integration below is **optional**. If its variables are absent, that feature is simply
reported as "not configured" (see `GET /api/health` and `GET /api/config`) and any pipeline
stage that needs it fails with a clear error rather than doing something silently wrong.

## Server

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` |
| `NODE_ENV` | `development` | `development`\|`production`\|`test` — also toggles pretty log output |
| `API_KEY` | unset | **Security-critical.** If unset, the API runs unauthenticated and a warning is logged at every boot. Set to a long random value; required as `Authorization: Bearer <key>` or `X-Api-Key: <key>` on every `/api/*` route except `/api/health`. |

## Database

| Variable | Default |
|---|---|
| `DATABASE_PATH` | `./data/vrms.db` |

## Storage

| Variable | Default |
|---|---|
| `DOWNLOAD_TEMP_DIR` | `./data/downloads` |
| `LIBRARY_MOVIES_DIR` | `./data/library/movies` |
| `LIBRARY_SHOWS_DIR` | `./data/library/shows` |
| `LIBRARY_ANIME_DIR` | `./data/library/anime` |
| `LIBRARY_MUSIC_DIR` | `./data/library/music` |

## Queue

| Variable | Default | Notes |
|---|---|---|
| `QUEUE_CONCURRENCY` | `2` | Max jobs processed in parallel |
| `QUEUE_POLL_INTERVAL_MS` | `2000` | How often the worker checks for claimable jobs |
| `QUEUE_MAX_RETRIES` | `3` | Retries before a job is marked permanently failed |
| `QUEUE_RETRY_BACKOFF_MS` | `30000` | Multiplied by the attempt number for backoff |

## qBittorrent (download provider)

| Variable | Notes |
|---|---|
| `QBITTORRENT_URL` | e.g. `http://localhost:8080` |
| `QBITTORRENT_USERNAME` | |
| `QBITTORRENT_PASSWORD` | |

All three must be set for the provider to be considered configured.

## SABnzbd (usenet download provider)

| Variable | Notes |
|---|---|
| `SABNZBD_URL` | e.g. `http://localhost:8080` |
| `SABNZBD_API_KEY` | SABnzbd Config → General → API Key |

Both required for the provider to add/track/cancel downloads. SABnzbd has no search API of its
own — configure a Newznab indexer below for `search()` to work.

## Newznab indexer (usenet search)

| Variable | Notes |
|---|---|
| `NEWZNAB_URL` | Your indexer's base URL, e.g. `https://api.nzbgeek.info` |
| `NEWZNAB_API_KEY` | From your indexer account |

## TMDB (movie/TV metadata)

| Variable | Notes |
|---|---|
| `TMDB_API_KEY` | Free at https://www.themoviedb.org/settings/api |

Anime (AniList) and music (MusicBrainz) metadata need no API key — they're always active.

## Jellyfin

| Variable | Notes |
|---|---|
| `JELLYFIN_URL` | e.g. `http://localhost:8096` |
| `JELLYFIN_API_KEY` | Generate under Jellyfin admin dashboard → API Keys |

## Notifications

| Variable | Notes |
|---|---|
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL |
| `NOTIFICATION_WEBHOOK_URLS` | Comma-separated list of generic outgoing webhook URLs |

## Virus scanning (optional)

| Variable | Default | Notes |
|---|---|---|
| `VIRUS_SCAN_ENABLED` | `false` | Set `true` to enable the `virus_scan` pipeline stage |
| `CLAMD_HOST` | `localhost` | clamd (ClamAV daemon) host |
| `CLAMD_PORT` | `3310` | clamd port |

## Naming templates

Override the default naming templates used by the organize stage. Tokens: `{title}` `{year}`
`{extension}` `{season}` `{seasonPadded}` `{episode}` `{episodePadded}` `{episodeTitle}`
`{artist}` `{album}` `{track}` `{trackPadded}`.

| Variable | Default |
|---|---|
| `NAMING_TEMPLATE_MOVIE` | `{title} ({year})/{title} ({year}){extension}` |
| `NAMING_TEMPLATE_SHOW` | `{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded} - {episodeTitle}{extension}` |
| `NAMING_TEMPLATE_ANIME` | `{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded}{extension}` |
| `NAMING_TEMPLATE_MUSIC` | `{artist}/{album} ({year})/{trackPadded} - {title}{extension}` |
