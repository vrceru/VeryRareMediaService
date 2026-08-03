# API Reference

All endpoints are under `/api`. Requests/responses are JSON. Validation errors return `400`
with `{ error: "ValidationError", issues: [...] }`; unknown resources return `404`; unexpected
failures return `500`.

## Authentication

If `API_KEY` is set (see [environment-variables.md](environment-variables.md)), every route
below except `/api/health` requires it, as either header:

```
Authorization: Bearer <API_KEY>
X-Api-Key: <API_KEY>
```

Missing or incorrect keys get `401 { "error": "Unauthorized", "message": "..." }`. If `API_KEY`
is unset, all routes are open — a warning is logged at every boot in that case.

## Health & config

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ status, uptimeSeconds, integrations: { qbittorrent, sabnzbd, newznab, directDownload, tmdb, jellyfin, discord, virusScan, apiAuth } }` |
| GET | `/api/config` | Read-only, secret-free view of the active configuration |

## Queue

| Method | Path | Description |
|---|---|---|
| POST | `/api/queue` | Enqueue a media request. Body: `{ title, mediaType?, year?, season?, episode?, searchQuery?, metadataId? }`. `metadataId` is the exact external ID for whatever metadata provider serves `mediaType` (TMDB numeric ID for movie/show, AniList numeric ID for anime, MusicBrainz MBID for music) — pass it when the caller already resolved an exact match, so `fetchMetadata` skips its own search and can't land on a different same-titled entry. Returns `201` + the created job. |
| GET | `/api/queue` | List jobs. Query: `status?`, `limit?` (max 200), `offset?` |
| GET | `/api/queue/stats` | Job counts grouped by status |

## Jobs

| Method | Path | Description |
|---|---|---|
| GET | `/api/jobs/:id` | Job detail |
| GET | `/api/jobs/:id/history` | Ordered stage-transition history for a job |
| POST | `/api/jobs/:id/cancel` | Cancel a pending/running/paused job |
| POST | `/api/jobs/:id/pause` | Pause a pending job |
| POST | `/api/jobs/:id/resume` | Resume a paused job |
| POST | `/api/jobs/:id/retry` | Reset a failed/cancelled job's retry budget and requeue it (restarts the full pipeline) |

## Approvals

See [approvals.md](approvals.md) for the full mechanism. Jobs land in `awaiting_release_approval`
or `awaiting_final_approval` between pipeline stages, waiting for one of these.

| Method | Path | Description |
|---|---|---|
| GET | `/api/approvals/releases` | Jobs awaiting Gate A, each with its candidate releases (parsed quality info included) and which one was auto-selected |
| POST | `/api/jobs/:id/approve-release` | Body `{ candidateId?: string }` — omit to keep the auto-selected release, or pass another candidate's `id` to switch. `400` if the job isn't awaiting this gate or the candidateId doesn't exist. |
| POST | `/api/jobs/:id/deny-release` | Cancel + clean up the job's temp directory |
| GET | `/api/approvals/final` | Jobs awaiting Gate B, each with matched metadata, the primary file path, and a live storage check (`freeBytes`/`requiredBytes`/`hasEnoughSpace`) |
| POST | `/api/jobs/:id/approve-final` | No body |
| POST | `/api/jobs/:id/deny-final` | Cancel + clean up |

## History

| Method | Path | Description |
|---|---|---|
| GET | `/api/history` | Completed/failed/cancelled jobs. Query: `limit?`, `offset?` |

## Stats (dashboard-prep)

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | One-call dashboard payload: `queueStatus`, `activeJobs` (with live download speed when the current stage is `download`), `recentActivity` (last 25 history entries across all jobs), `errorHistory` (recent failed jobs), `storageUsageBytes` (per library + temp) |

## Notifications

| Method | Path | Description |
|---|---|---|
| POST | `/api/notifications/test` | Sends a test event through every configured notifier |

## Library

| Method | Path | Description |
|---|---|---|
| POST | `/api/library/refresh` | Triggers a full Jellyfin library scan (`400` if Jellyfin isn't configured) |
| GET | `/api/library/test-connection` | `{ configured, connected }` |

## Example: enqueue and watch a job

```bash
curl -X POST http://localhost:8787/api/queue \
  -H "Content-Type: application/json" \
  -d '{"title": "Sintel", "mediaType": "movie", "year": 2010}'

# -> { "id": "...", "status": "pending", "stage": "received", ... }

curl http://localhost:8787/api/jobs/<id>
curl http://localhost:8787/api/jobs/<id>/history
```
