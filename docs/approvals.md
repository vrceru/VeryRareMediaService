# Admin Approval Workflow

By default, a job runs the whole pipeline in one shot with no human checkpoint. If you want a
person to sign off before anything downloads or before it lands in the library, the pipeline
supports two optional pause points ("gates"). Nothing about this is configurable via env var —
it's just part of the stage list every job goes through; the only lever is whether an admin
approves promptly or lets a job sit.

## The two gates

### Gate A — release approval (`awaiting_release_approval`)

Runs right after release search/selection, before anything downloads. The job pauses with its
full list of candidate releases attached (`stages/awaitReleaseApproval.ts`, persisted via
`QueueService.holdForReleaseApproval`).

An admin can:
- **Approve** the auto-selected release — `POST /api/jobs/:id/approve-release` with an empty body.
- **Approve a different candidate** — same endpoint with `{ "candidateId": "<id>" }`, where the
  id is one of the `candidates[].id` values from `GET /api/approvals/releases`.
- **Deny** — `POST /api/jobs/:id/deny-release` — cancels the job and cleans up its temp directory.

### Gate B — final approval (`awaiting_final_approval`)

Runs after download, verification, virus scan, extraction, validation, media-type
identification, and metadata lookup — everything the pipeline can determine about the file — but
before it's renamed, organized into the library, or pushed to Jellyfin
(`stages/awaitFinalApproval.ts`, persisted via `QueueService.holdForFinalApproval`).

`GET /api/approvals/final` shows the matched metadata, the downloaded file's path, and a live
free-space check (`freeBytes`/`requiredBytes`/`hasEnoughSpace`) against the destination library
so the admin can see if the disk has room before approving — nothing is blocked automatically at
this point, since the point is to inform the decision, not make it. `organizeLibrary.ts` still
does a hard space check right before it actually moves the file, regardless of what the admin saw.

An admin can:
- **Approve** — `POST /api/jobs/:id/approve-final`, no body.
- **Deny** — `POST /api/jobs/:id/deny-final` — cancels and cleans up, same as Gate A.

## How pausing and resuming actually works

`runner.ts` checks the job's status after every stage; if a gate stage just flipped it to one of
the two "awaiting" statuses, the loop stops and `runPipeline` returns normally — not an error, no
retry, no `processing.failed` notification. The job just sits there: `claimNext()`'s
`WHERE status = 'pending'` already excludes it from being picked up again, so no worker slot is
wasted waiting on a human.

On approval, the API sets the job's `stage` column directly to the name of the stage *after* the
gate (`download` for Gate A, `rename_files` for Gate B, via `pipeline/runner.ts`'s `stageAfter()`)
and flips status back to `pending`. When the worker reclaims it, `runPipeline` finds that stage
name in its ordered `STAGES` list and starts exactly there — the gate stage itself, and
everything before it, is skipped.

Since only the job's DB row survives between the pause and the resume (not the in-memory
pipeline state), a resumed run rebuilds what it needs from persisted columns rather than a
serialized state blob:

| Column | Rebuilds |
|---|---|
| `selected_release` (JSON) | `state.selectedRelease`, plus `state.parsedRelease` re-derived via `parseReleaseName` (pure and deterministic — no need to persist the parsed form separately) |
| `metadata` (JSON) | `state.metadata` |
| `primary_media_file` | `state.primaryMediaFile` |

`download.ts` was updated to look up the download provider from `selectedRelease.providerId` via
the registry when `state.downloadProvider` isn't already set (normally `selectRelease.ts` sets
it, but that stage is skipped when resuming past Gate A).

This mechanism (`job.stage`-based skip-ahead) is reserved for these deliberate, admin-triggered
resumes. An ordinary failure retry (`QueueService.failJob`/`retryJob`) explicitly resets `stage`
back to `received` first, so a transient failure always restarts the whole pipeline rather than
accidentally skipping ahead.

## Denying cleans up temp files

Neither gate's deny path nor the pre-existing `POST /api/jobs/:id/cancel` leaves anything behind:
`pipeline/approvals.ts`'s deny handlers call `cancelJob` then `cleanupJobTempDir` (the same
utility the final `archiveHistory` stage uses on success).
