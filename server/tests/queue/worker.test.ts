import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDb } from "../../src/db/client.js";
import type { Db } from "../../src/db/client.js";
import { QueueService } from "../../src/queue/queueService.js";
import { JobWorker } from "../../src/queue/worker.js";
import { JobCancelledError } from "../../src/queue/types.js";
import type { Job } from "../../src/queue/types.js";

describe("JobWorker", () => {
  let db: Db;
  let queue: QueueService;

  beforeEach(() => {
    db = createDb(":memory:");
    queue = new QueueService(db, { maxRetries: 2, retryBackoffMs: 1000 });
  });

  it("frees the concurrency slot without touching the job row when the stage throws JobCancelledError", async () => {
    const enqueued = queue.enqueue({ title: "Movie" });
    const claimed = queue.claimNext()!;
    queue.cancelJob(claimed.id);

    const failJobSpy = vi.spyOn(queue, "failJob");
    const runJob = async (_job: Job) => {
      throw new JobCancelledError(claimed.id);
    };

    // Reach into the private execute() the same way tick()/start() would -- there's no public
    // single-job-run entry point, so this mirrors what the real scheduling loop does.
    const worker = new JobWorker(queue, runJob, { concurrency: 2, pollIntervalMs: 100000 });
    await (worker as unknown as { execute(job: Job): Promise<void> }).execute(claimed);

    expect(failJobSpy).not.toHaveBeenCalled();
    expect(queue.getJob(enqueued.id)?.status).toBe("cancelled");
  });

  it("still calls failJob for an ordinary error", async () => {
    const claimed = queue.claimNext.bind(queue);
    queue.enqueue({ title: "Movie" });
    const job = claimed()!;

    const runJob = async (_job: Job) => {
      throw new Error("boom");
    };
    const worker = new JobWorker(queue, runJob, { concurrency: 2, pollIntervalMs: 100000 });
    await (worker as unknown as { execute(job: Job): Promise<void> }).execute(job);

    expect(queue.getJob(job.id)?.errorMessage).toBe("boom");
  });
});
