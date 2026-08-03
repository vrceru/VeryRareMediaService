# Pipeline

A media request goes through 20 stages. Stage 1 happens at enqueue time; stages 2-20 run in
order inside `runPipeline` (`server/src/pipeline/runner.ts`) once the worker claims the job.
Each stage updates the job's `stage` column and appends a `job_history` row, so progress is
visible in real time via `GET /api/jobs/:id` and `GET /api/jobs/:id/history`.

Two of the stages are optional admin-approval gates that pause the job rather than doing work
themselves — see [approvals.md](approvals.md) for the full mechanism (how pausing/resuming
across gates actually works, and how it's kept separate from ordinary failure retries).

| # | Stage | File | What it does |
|---|---|---|---|
| 1 | Receive request | `queue/queueService.ts` (`enqueue`) | `POST /api/queue` validates the shape and inserts a `pending` job |
| 2 | Validate request | `stages/validateRequest.ts` | Title non-empty, media type/season sane |
| 3 | Search providers | `stages/searchProviders.ts` | Queries every configured `DownloadProvider` |
| 4 | Select release | `stages/selectRelease.ts` | Parses each candidate's name and ranks by seeders + technical quality + request relevance (see [release-parsing.md](release-parsing.md)) |
| 5 | **Gate A: await release approval** | `stages/awaitReleaseApproval.ts` | Pauses the job (`awaiting_release_approval`) with the candidate list attached, for an admin to approve/switch/deny via `/api/approvals/releases` and friends |
| 6 | Download | `stages/download.ts` | Starts the download, polls until complete/error/timeout |
| 7 | Verify download | `stages/verifyDownload.ts` | Confirms files exist and are non-empty |
| 8 | Virus scan | `stages/virusScan.ts` | Skipped unless `VIRUS_SCAN_ENABLED=true`; scans via clamd |
| 9 | Extract archives | `stages/extractArchive.ts` | Extracts `.zip` and `.rar` releases (more formats: extend `services/archive`) |
| 10 | Validate media | `stages/validateMedia.ts` | Filters to real media files, picks the primary one |
| 11 | Identify media | `stages/identifyMedia.ts` | Uses the request's `mediaType`, or heuristics (informed by the parsed release) if absent |
| 12 | Fetch metadata | `stages/fetchMetadata.ts` | Queries the matching `MetadataProvider`, using the request's year/season/episode or the parsed release's as a fallback |
| 13 | **Gate B: await final approval** | `stages/awaitFinalApproval.ts` | Pauses the job (`awaiting_final_approval`) with the matched metadata + file, for an admin to approve/deny via `/api/approvals/final` and friends |
| 14 | Rename files | `stages/renameFiles.ts` | Computes the sanitized destination path from the naming template |
| 15 | Organize library | `stages/organizeLibrary.ts` | Dedupes against the library, hard-checks free disk space, then moves the file |
| 16 | Generate artwork | `stages/generateArtwork.ts` | Downloads the metadata provider's poster as `folder.jpg` |
| 17 | Update Jellyfin | `stages/updateJellyfin.ts` | Targeted `Library/Media/Updated` notify (non-fatal on failure) |
| 18 | Send notifications | `stages/sendNotifications.ts` | Dispatches `queue.finished` once the queue drains |
| 19 | Log completion | `stages/logCompletion.ts` | Structured log line + marks the job `completed` |
| 20 | Archive history | `stages/archiveHistory.ts` | Cleans up the job's temp directory, writes closing history entry |

`download.started`, `download.completed`, `processing.failed`, and `library.updated` are
dispatched from the stage that actually causes them (download, download, the runner's catch
block, and updateJellyfin respectively) rather than from a single "notify" stage — see
[providers.md](providers.md) for the notification event list.

## Failure handling

If any stage throws, `runPipeline` dispatches a `processing.failed` notification and rethrows.
`JobWorker` catches that and calls `QueueService.failJob`, which either reschedules the job
(`pending`, with `next_attempt_at` pushed out by `QUEUE_RETRY_BACKOFF_MS * attempt`, and `stage`
reset back to `received` so the retry restarts the whole pipeline) or marks it `failed` once
`QUEUE_MAX_RETRIES` is exhausted. The temp directory is only cleaned up on success (stage 20) or
when a job is denied at one of the approval gates — a job that's simply failed and awaiting retry
keeps its downloaded files in `DOWNLOAD_TEMP_DIR/<jobId>/` for inspection.
