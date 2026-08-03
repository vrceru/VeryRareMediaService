# Architecture

## Stack

- **Runtime**: Node.js + TypeScript (strict), ESM.
- **HTTP**: [Fastify](https://fastify.dev/), with Zod request validation.
- **Persistence**: SQLite via Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html)
  module — no native compilation step, no external database server. One file
  (`DATABASE_PATH`) holds job queue state and history.
- **Job queue**: DB-backed, in-process. No Redis or other broker — `QueueService` reads/writes
  job rows directly, and `JobWorker` polls for claimable work on an interval.
- **Logging**: [Pino](https://getpino.io/), structured JSON in production, pretty-printed in dev.
- **Tests**: [Vitest](https://vitest.dev/).

## Why no Drizzle/better-sqlite3?

The original plan called for Drizzle ORM over `better-sqlite3`, but `better-sqlite3` requires a
native build step (`node-gyp`) that needs Visual Studio Build Tools — not guaranteed to be
present on a self-hosted Windows box, and not available in this environment. Node's built-in
`node:sqlite` (stable since Node 22.5+) needs zero native compilation and covers everything this
service needs, so the DB access layer is a small hand-written repository (`src/queue/queueService.ts`)
over raw SQL instead of an ORM. This is a deliberate simplification, not a missing feature.

## Composition root

`src/appContext.ts` builds a single `AppContext` object at startup: config, the SQLite handle,
the queue service, the download/metadata provider registries, the Jellyfin client (if
configured), the notification dispatcher, and the virus scanner. Every route handler and
pipeline stage receives this object rather than reaching for globals — that's what makes the
pipeline stages and API routes straightforward to unit test (see `tests/`).

## Request lifecycle

1. A client calls `POST /api/queue` with a media request (title, optional media type/year/season).
2. `QueueService.enqueue` writes a `pending` row to the `jobs` table.
3. `JobWorker` polls the queue (`QUEUE_POLL_INTERVAL_MS`) and claims up to `QUEUE_CONCURRENCY`
   jobs at a time, running each through `runPipeline` (see [pipeline.md](pipeline.md)).
4. Each pipeline stage updates the job's `stage` column and appends a `job_history` row, so
   progress is visible via `GET /api/jobs/:id` and `GET /api/jobs/:id/history` while it runs.
5. On failure, `QueueService.failJob` retries with exponential-ish backoff up to
   `QUEUE_MAX_RETRIES`, then marks the job `failed`. On success, the job is marked `completed`
   and its temp directory is cleaned up.

## Directory structure

```
server/src/
  config/          Zod schema + loadConfig() — env vars, defaults, validation
  db/              node:sqlite bootstrap + row types
  queue/           QueueService, JobWorker, job/history types
  pipeline/        PipelineContext + one file per stage, runner.ts ties them together
  providers/
    download/      DownloadProvider interface, qbittorrent/ (real), NotConfiguredProvider stubs
    metadata/      MetadataProvider interface, tmdb/, anilist/, musicbrainz/
  services/        archive, validation, checksum, cleanup, naming, organization, artwork, virusscan
  integrations/
    jellyfin/       Jellyfin REST client
    notifications/  Notifier interface, discord.ts, webhook.ts, dispatcher.ts
  api/              Fastify server, routes/, middleware/
  logging/          Pino setup
  security/         path traversal guard, filename sanitizer
```
