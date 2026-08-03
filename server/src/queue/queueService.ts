import { randomUUID } from "node:crypto";
import type { Db } from "../db/client.js";
import type { JobRow, JobHistoryRow, JobStatus } from "../db/schema.js";
import type { Job, JobHistoryEntry, JobListFilter, MediaRequest } from "./types.js";
import type { ReleaseCandidate } from "../providers/download/types.js";
import type { MediaMetadata } from "../providers/metadata/types.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("queue");

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    mediaType: row.media_type,
    title: row.title,
    request: JSON.parse(row.request_payload) as MediaRequest,
    selectedRelease: row.selected_release ? (JSON.parse(row.selected_release) as ReleaseCandidate) : null,
    releaseCandidates: row.release_candidates ? (JSON.parse(row.release_candidates) as ReleaseCandidate[]) : null,
    metadata: row.metadata ? (JSON.parse(row.metadata) as MediaMetadata) : null,
    primaryMediaFile: row.primary_media_file,
    downloadProviderId: row.download_provider_id,
    downloadRef: row.download_ref,
    progress: row.progress,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function rowToHistory(row: JobHistoryRow): JobHistoryEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    stage: row.stage,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
  };
}

export interface QueueServiceOptions {
  maxRetries: number;
  retryBackoffMs: number;
}

/**
 * DB-backed job queue. All state lives in SQLite; JobWorker polls claimNext() to pull work.
 * No external queue infra (Redis, etc.) required.
 */
export class QueueService {
  constructor(
    private readonly db: Db,
    private readonly options: QueueServiceOptions,
  ) {}

  enqueue(request: MediaRequest): Job {
    const now = Date.now();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO jobs (id, status, stage, media_type, title, request_payload, progress, retry_count, max_retries, created_at, updated_at)
         VALUES (?, 'pending', 'received', ?, ?, ?, 0, 0, ?, ?, ?)`,
      )
      .run(
        id,
        request.mediaType ?? null,
        request.title,
        JSON.stringify(request),
        this.options.maxRetries,
        now,
        now,
      );
    this.appendHistory(id, "received", "pending", "Job enqueued");
    log.info({ jobId: id, title: request.title }, "job enqueued");
    return this.getJob(id)!;
  }

  /** Atomically claims the oldest job that's ready to run (pending, or failed-and-due-for-retry). */
  claimNext(): Job | undefined {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const now = Date.now();
      const row = this.db
        .prepare(
          `SELECT * FROM jobs
           WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
           ORDER BY created_at ASC LIMIT 1`,
        )
        .get(now) as unknown as JobRow | undefined;

      if (!row) {
        this.db.exec("COMMIT");
        return undefined;
      }

      this.db
        .prepare(
          `UPDATE jobs SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`,
        )
        .run(now, now, row.id);
      this.db.exec("COMMIT");

      const job = this.getJob(row.id)!;
      this.appendHistory(job.id, job.stage, "running", "Job claimed by worker");
      return job;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  getJob(id: string): Job | undefined {
    const row = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as unknown as JobRow | undefined;
    return row ? rowToJob(row) : undefined;
  }

  listJobs(filter: JobListFilter = {}): Job[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      clauses.push(`status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const rows = this.db
      .prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as unknown as JobRow[];
    return rows.map(rowToJob);
  }

  countByStatus(): Record<JobStatus, number> {
    const rows = this.db
      .prepare(`SELECT status, COUNT(*) as count FROM jobs GROUP BY status`)
      .all() as unknown as { status: JobStatus; count: number }[];
    const result: Record<JobStatus, number> = {
      pending: 0,
      running: 0,
      paused: 0,
      awaiting_release_approval: 0,
      awaiting_final_approval: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const row of rows) result[row.status] = row.count;
    return result;
  }

  updateStage(id: string, stage: string, message?: string): void {
    const now = Date.now();
    this.db.prepare(`UPDATE jobs SET stage = ?, updated_at = ? WHERE id = ?`).run(stage, now, id);
    const job = this.getJob(id);
    this.appendHistory(id, stage, job?.status ?? "running", message ?? null);
  }

  updateProgress(id: string, progress: number): void {
    this.db
      .prepare(`UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?`)
      .run(Math.max(0, Math.min(1, progress)), Date.now(), id);
  }

  setSelectedRelease(id: string, release: ReleaseCandidate): void {
    this.db
      .prepare(`UPDATE jobs SET selected_release = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(release), Date.now(), id);
  }

  /** Snapshot of search results for the release-approval gate to show an admin. */
  setReleaseCandidates(id: string, candidates: ReleaseCandidate[]): void {
    this.db
      .prepare(`UPDATE jobs SET release_candidates = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(candidates), Date.now(), id);
  }

  /** Persisted once fetchMetadata runs — needed for the final-approval gate's display and
   * for resuming after approval without a redundant network round-trip. */
  setMetadata(id: string, metadata: MediaMetadata): void {
    this.db
      .prepare(`UPDATE jobs SET metadata = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(metadata), Date.now(), id);
  }

  setPrimaryMediaFile(id: string, filePath: string): void {
    this.db
      .prepare(`UPDATE jobs SET primary_media_file = ?, updated_at = ? WHERE id = ?`)
      .run(filePath, Date.now(), id);
  }

  setMediaType(id: string, mediaType: string): void {
    this.db
      .prepare(`UPDATE jobs SET media_type = ?, updated_at = ? WHERE id = ?`)
      .run(mediaType, Date.now(), id);
  }

  setDownloadRef(id: string, providerId: string, ref: string): void {
    this.db
      .prepare(
        `UPDATE jobs SET download_provider_id = ?, download_ref = ?, updated_at = ? WHERE id = ?`,
      )
      .run(providerId, ref, Date.now(), id);
  }

  /** Pauses a job for admin review of the candidate releases found (the "Gate A" checkpoint).
   * The worker naturally leaves it alone since claimNext() only looks at 'pending' jobs. */
  holdForReleaseApproval(id: string, candidates: ReleaseCandidate[]): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE jobs SET status = 'awaiting_release_approval', release_candidates = ?, updated_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(candidates), now, id);
    this.appendHistory(id, "await_release_approval", "awaiting_release_approval", "Awaiting admin approval of release");
  }

  /** Pauses a job for admin review of the matched metadata + file before it's organized into
   * the library (the "Gate B" checkpoint). */
  holdForFinalApproval(id: string, metadata: MediaMetadata, primaryMediaFile: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE jobs SET status = 'awaiting_final_approval', metadata = ?, primary_media_file = ?, updated_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(metadata), primaryMediaFile, now, id);
    this.appendHistory(id, "await_final_approval", "awaiting_final_approval", "Awaiting final admin approval");
  }

  /** Resumes a held job at a specific pipeline stage (set by the caller — see
   * pipeline/approvals.ts) rather than from the beginning. */
  resumeAtStage(id: string, stageName: string, message: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE jobs SET status = 'pending', stage = ?, next_attempt_at = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(stageName, now, id);
    this.appendHistory(id, stageName, "pending", message);
  }

  completeJob(id: string, message?: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE jobs SET status = 'completed', progress = 1, completed_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(now, now, id);
    this.appendHistory(id, "archived", "completed", message ?? "Job completed successfully");
    log.info({ jobId: id }, "job completed");
  }

  /** Marks a job failed at its current stage. Retries with backoff if attempts remain. */
  failJob(id: string, error: string): void {
    const job = this.getJob(id);
    if (!job) return;
    const now = Date.now();
    const nextRetryCount = job.retryCount + 1;

    if (nextRetryCount <= job.maxRetries) {
      const nextAttemptAt = now + this.options.retryBackoffMs * nextRetryCount;
      // Reset stage to "received" so the retry restarts the full pipeline from the top —
      // resuming mid-pipeline (runner.ts's job.stage-based skip-ahead) is reserved for the
      // deliberate approval-gate flow (resumeAtStage), not ordinary failure retries.
      this.db
        .prepare(
          `UPDATE jobs SET status = 'pending', stage = 'received', retry_count = ?, next_attempt_at = ?, error_message = ?, updated_at = ? WHERE id = ?`,
        )
        .run(nextRetryCount, nextAttemptAt, error, now, id);
      this.appendHistory(
        id,
        job.stage,
        "pending",
        `Attempt ${nextRetryCount}/${job.maxRetries} failed: ${error}. Retrying at ${new Date(nextAttemptAt).toISOString()}`,
      );
      log.warn({ jobId: id, retryCount: nextRetryCount, error }, "job failed, retry scheduled");
    } else {
      this.db
        .prepare(
          `UPDATE jobs SET status = 'failed', retry_count = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(nextRetryCount, error, now, now, id);
      this.appendHistory(id, job.stage, "failed", `Exhausted retries: ${error}`);
      log.error({ jobId: id, error }, "job failed permanently");
    }
  }

  /** Resets a failed (or cancelled) job back to pending with a fresh retry budget, restarting
   * the full pipeline from the top (see the note in failJob about why stage is reset). */
  retryJob(id: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE jobs SET status = 'pending', stage = 'received', retry_count = 0, next_attempt_at = NULL, error_message = NULL, updated_at = ? WHERE id = ? AND status IN ('failed','cancelled')`,
      )
      .run(now, id);
    this.appendHistory(id, "received", "pending", "Job manually retried");
  }

  cancelJob(id: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE jobs SET status = 'cancelled', completed_at = ?, updated_at = ? WHERE id = ? AND status IN ('pending','running','paused','awaiting_release_approval','awaiting_final_approval')`,
      )
      .run(now, now, id);
    this.appendHistory(id, "cancelled", "cancelled", "Job cancelled by user");
  }

  pauseJob(id: string): void {
    this.db
      .prepare(`UPDATE jobs SET status = 'paused', updated_at = ? WHERE id = ? AND status = 'pending'`)
      .run(Date.now(), id);
    this.appendHistory(id, "paused", "paused", "Job paused by user");
  }

  resumeJob(id: string): void {
    this.db
      .prepare(
        `UPDATE jobs SET status = 'pending', next_attempt_at = NULL, updated_at = ? WHERE id = ? AND status = 'paused'`,
      )
      .run(Date.now(), id);
    this.appendHistory(id, "pending", "pending", "Job resumed by user");
  }

  /** Most recent history entries across all jobs, newest first — used for dashboard "recent activity". */
  recentHistory(limit = 25): JobHistoryEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM job_history ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as unknown as JobHistoryRow[];
    return rows.map(rowToHistory);
  }

  getHistory(jobId: string): JobHistoryEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM job_history WHERE job_id = ? ORDER BY created_at ASC`)
      .all(jobId) as unknown as JobHistoryRow[];
    return rows.map(rowToHistory);
  }

  appendHistory(jobId: string, stage: string, status: string, message?: string | null): void {
    this.db
      .prepare(
        `INSERT INTO job_history (job_id, stage, status, message, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(jobId, stage, status, message ?? null, Date.now());
  }
}
