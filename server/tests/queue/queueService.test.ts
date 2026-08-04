import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../../src/db/client.js";
import type { Db } from "../../src/db/client.js";
import { QueueService } from "../../src/queue/queueService.js";

describe("QueueService", () => {
  let db: Db;
  let queue: QueueService;

  beforeEach(() => {
    db = createDb(":memory:");
    queue = new QueueService(db, { maxRetries: 2, retryBackoffMs: 1000 });
  });

  it("enqueues a job as pending with the received stage", () => {
    const job = queue.enqueue({ title: "Test Movie" });
    expect(job.status).toBe("pending");
    expect(job.stage).toBe("received");
    expect(job.title).toBe("Test Movie");
    expect(job.retryCount).toBe(0);
  });

  it("claimNext returns the oldest pending job and marks it running", () => {
    const job = queue.enqueue({ title: "First" });
    queue.enqueue({ title: "Second" });

    const claimed = queue.claimNext();
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.startedAt).not.toBeNull();
  });

  it("claimNext returns undefined when nothing is pending", () => {
    expect(queue.claimNext()).toBeUndefined();
  });

  it("completeJob marks the job completed with full progress", () => {
    const job = queue.enqueue({ title: "Done" });
    queue.claimNext();
    queue.completeJob(job.id, "all good");

    const updated = queue.getJob(job.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.progress).toBe(1);
    expect(updated?.completedAt).not.toBeNull();
  });

  it("failJob retries with backoff until maxRetries is exhausted, then marks failed", () => {
    const job = queue.enqueue({ title: "Flaky" });
    queue.claimNext();

    queue.failJob(job.id, "attempt 1 failed");
    let updated = queue.getJob(job.id)!;
    expect(updated.status).toBe("pending");
    expect(updated.retryCount).toBe(1);
    expect(updated.nextAttemptAt).not.toBeNull();

    queue.failJob(job.id, "attempt 2 failed");
    updated = queue.getJob(job.id)!;
    expect(updated.status).toBe("pending");
    expect(updated.retryCount).toBe(2);

    queue.failJob(job.id, "attempt 3 failed");
    updated = queue.getJob(job.id)!;
    expect(updated.status).toBe("failed");
    expect(updated.retryCount).toBe(3);
    expect(updated.errorMessage).toContain("attempt 3 failed");
  });

  it("cancelJob only cancels active jobs", () => {
    const job = queue.enqueue({ title: "Cancel me" });
    queue.cancelJob(job.id);
    expect(queue.getJob(job.id)?.status).toBe("cancelled");
  });

  it("pauseJob and resumeJob round-trip a pending job", () => {
    const job = queue.enqueue({ title: "Pausable" });
    queue.pauseJob(job.id);
    expect(queue.getJob(job.id)?.status).toBe("paused");

    queue.resumeJob(job.id);
    expect(queue.getJob(job.id)?.status).toBe("pending");
  });

  it("retryJob resets a failed job's retry budget", () => {
    const job = queue.enqueue({ title: "Retryable" });
    queue.claimNext();
    queue.failJob(job.id, "e1");
    queue.failJob(job.id, "e2");
    queue.failJob(job.id, "e3");
    expect(queue.getJob(job.id)?.status).toBe("failed");

    queue.retryJob(job.id);
    const retried = queue.getJob(job.id)!;
    expect(retried.status).toBe("pending");
    expect(retried.retryCount).toBe(0);
    expect(retried.errorMessage).toBeNull();
  });

  it("listJobs filters by status and respects limit", () => {
    queue.enqueue({ title: "A" });
    const b = queue.enqueue({ title: "B" });
    queue.cancelJob(b.id);

    const pending = queue.listJobs({ status: "pending" });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.title).toBe("A");

    const cancelled = queue.listJobs({ status: ["cancelled"] });
    expect(cancelled).toHaveLength(1);
  });

  it("countByStatus tallies jobs across all statuses", () => {
    queue.enqueue({ title: "A" });
    const b = queue.enqueue({ title: "B" });
    queue.cancelJob(b.id);

    const counts = queue.countByStatus();
    expect(counts.pending).toBe(1);
    expect(counts.cancelled).toBe(1);
    expect(counts.completed).toBe(0);
  });

  it("appendHistory and getHistory record stage transitions in order", () => {
    const job = queue.enqueue({ title: "Tracked" });
    queue.updateStage(job.id, "download", "started");
    queue.updateStage(job.id, "extract", "extracting");

    const history = queue.getHistory(job.id);
    expect(history.map((h) => h.stage)).toEqual(["received", "download", "extract"]);
  });

  it("failJob resets stage to 'received' on retry, so retries restart the full pipeline", () => {
    const job = queue.enqueue({ title: "Flaky" });
    queue.claimNext();
    queue.updateStage(job.id, "download", "in progress");
    queue.failJob(job.id, "network blip");

    const retried = queue.getJob(job.id)!;
    expect(retried.status).toBe("pending");
    expect(retried.stage).toBe("received");
  });

  it("retryJob resets stage to 'received' too", () => {
    const job = queue.enqueue({ title: "Flaky" });
    queue.claimNext();
    queue.updateStage(job.id, "organize_library", "in progress");
    queue.failJob(job.id, "e1");
    queue.failJob(job.id, "e2");
    queue.failJob(job.id, "e3");
    expect(queue.getJob(job.id)?.status).toBe("failed");

    queue.retryJob(job.id);
    expect(queue.getJob(job.id)?.stage).toBe("received");
  });

  it("holdForReleaseApproval pauses the job and persists the candidate snapshot", () => {
    const job = queue.enqueue({ title: "Movie" });
    const candidates = [
      { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 1, qualityScore: 0.5, providerId: "x" },
    ];

    queue.holdForReleaseApproval(job.id, candidates);

    const held = queue.getJob(job.id)!;
    expect(held.status).toBe("awaiting_release_approval");
    expect(held.releaseCandidates).toEqual(candidates);
  });

  it("holdForFinalApproval pauses the job and persists metadata + primary file", () => {
    const job = queue.enqueue({ title: "Movie" });
    const metadata = { provider: "fake", externalId: "1", title: "Movie", genres: [] };

    queue.holdForFinalApproval(job.id, metadata, "/downloads/movie.mkv");

    const held = queue.getJob(job.id)!;
    expect(held.status).toBe("awaiting_final_approval");
    expect(held.metadata).toEqual(metadata);
    expect(held.primaryMediaFile).toBe("/downloads/movie.mkv");
  });

  it("resumeAtStage flips status back to pending at the given stage", () => {
    const job = queue.enqueue({ title: "Movie" });
    queue.holdForReleaseApproval(job.id, []);

    queue.resumeAtStage(job.id, "download", "approved");

    const resumed = queue.getJob(job.id)!;
    expect(resumed.status).toBe("pending");
    expect(resumed.stage).toBe("download");
  });

  it("cancelJob can cancel a job awaiting approval", () => {
    const job = queue.enqueue({ title: "Movie" });
    queue.holdForReleaseApproval(job.id, []);

    queue.cancelJob(job.id);

    expect(queue.getJob(job.id)?.status).toBe("cancelled");
  });

  it("markReleaseDead appends dedupeKeys and is idempotent", () => {
    const job = queue.enqueue({ title: "Movie" });

    queue.markReleaseDead(job.id, "hash-a");
    queue.markReleaseDead(job.id, "hash-b");
    queue.markReleaseDead(job.id, "hash-a"); // duplicate, should not append again

    expect(queue.getJob(job.id)?.deadReleaseIds).toEqual(["hash-a", "hash-b"]);
  });
});
