# Providers

VRMS is modular by design: every download backend and metadata source implements a common
interface (`server/src/providers/*/types.ts`) and is looked up through a registry, so adding a
new one never requires touching pipeline code.

## Download providers (`providers/download/`)

```ts
interface DownloadProvider {
  readonly id: string;
  readonly displayName: string;
  isConfigured(): boolean;
  search(query: SearchQuery): Promise<ReleaseCandidate[]>;
  addDownload(release: ReleaseCandidate, destinationDir: string): Promise<string>; // returns a downloadRef
  getStatus(downloadRef: string): Promise<DownloadStatus>;
  cancel(downloadRef: string): Promise<void>;
}
```

| Provider | Status | Notes |
|---|---|---|
| `qbittorrent` | **Real** | Talks to the qBittorrent Web API: auth, plugin-based search, add-by-magnet, status polling, delete. Requires `QBITTORRENT_*` env vars. |
| `sabnzbd` | **Real** | Talks to the SABnzbd Web API for add/status/cancel (`SABNZBD_*`). Search goes through a separate Newznab-compatible indexer client (`NEWZNAB_*`) — SABnzbd itself has no search API. `addDownload`'s `destinationDir` is accepted but ignored: SABnzbd has no per-job save-path option for URL adds, so the file lands wherever the category's completed-download folder is, and `getStatus` reports that path once history confirms completion. |
| `direct-download` | **Real** | Streams a direct HTTP(S) URL to disk itself — no external client or credentials involved, so it's always active. See below for details. |

Release selection (`pipeline/stages/selectRelease.ts`) blends three signals per candidate: the
provider's own `qualityScore` (for qBittorrent, seeders-weighted), the technical quality parsed
from the release name, and how well the parsed name matches the request's year/season/episode.
See [release-parsing.md](release-parsing.md) for the parser itself.

### Direct download

Unlike qBittorrent and SABnzbd, there's no external daemon to hand the job to — VRMS's own
process (`providers/download/directDownload/provider.ts`) streams the HTTP response straight to
disk, tracks progress in memory, and resumes via an HTTP `Range` request if the connection drops
mid-transfer (up to 5 attempts). Since it needs no credentials, it's always configured/active.

- `search()` only returns a result when the query is itself a URL — there's no generic "search"
  across arbitrary direct-download sources. Enqueue a request with a direct URL as the
  `searchQuery` to use it.
- Every URL is checked by `security/ssrfGuard.ts` before fetching: only `http`/`https` are
  allowed, and the resolved IP is rejected if it falls in a loopback/private/link-local range
  (this also blocks the common cloud-metadata-endpoint address). Required because the URL
  ultimately comes from request/search input the server doesn't control.
- Progress tracking is in-memory only — a server restart loses it, and the queue's normal retry
  logic just restarts the download as a fresh attempt. Resume only covers a dropped connection
  within the same process run, not a full restart.

## Metadata providers (`providers/metadata/`)

```ts
interface MetadataProvider {
  readonly id: string;
  readonly mediaType: MediaType;
  isConfigured(): boolean;
  search(query: string, year?: number): Promise<MetadataSearchResult[]>;
  getDetails(externalId: string, options?: MetadataLookupOptions): Promise<MediaMetadata>;
}
```

| Media type | Provider | Auth | Notes |
|---|---|---|---|
| `movie` | TMDB | `TMDB_API_KEY` (free) | Also fetches genres, poster, backdrop, rating |
| `show` | TMDB | `TMDB_API_KEY` (free) | Also fetches per-episode titles when season/episode are known |
| `anime` | AniList | none — free public GraphQL API | Prefers the English title, falls back to romaji |
| `music` | MusicBrainz | none — free public API | Cover art via the Cover Art Archive; sends the required descriptive `User-Agent` |

`MetadataProviderRegistry.get(mediaType)` always returns a provider instance for the four
built-in media types — `isConfigured()` tells you whether it can actually be used yet (only
matters for TMDB, since AniList/MusicBrainz need no key).

## Notifications (`integrations/notifications/`)

```ts
interface Notifier {
  readonly id: string;
  isConfigured(): boolean;
  send(event: NotificationEvent): Promise<void>;
}
```

| Notifier | Config | Notes |
|---|---|---|
| `discord` | `DISCORD_WEBHOOK_URL` | Posts a colored embed per event type |
| `webhook` | `NOTIFICATION_WEBHOOK_URLS` (comma-separated) | Posts the raw `NotificationEvent` JSON to every URL |

`NotificationDispatcher.dispatch()` fans an event out to every configured notifier and isolates
failures per-notifier — one broken webhook never blocks another or the pipeline.

Event types: `download.started`, `download.completed`, `processing.failed`, `library.updated`,
`queue.finished`.

## Jellyfin (`integrations/jellyfin/client.ts`)

Not a pluggable-provider interface (there's only one Jellyfin), but follows the same
never-hardcode-server-details rule: `JELLYFIN_URL` / `JELLYFIN_API_KEY` only. Supports:
`testConnection`, `refreshLibrary` (full scan), `notifyPathUpdated` (targeted, preferred),
`findItemByPath`, `notifyAdmins`.

## Adding a new provider

1. Implement the relevant interface in a new subfolder (e.g. `providers/download/sabnzbd/`).
2. Register it in `registry.ts` for that provider category.
3. Add any new config fields to `config/schema.ts` and `config/index.ts` (optional group —
   never require it, never default a secret).
4. No other file needs to change — the pipeline stages already work against the interface.
