import { describe, it, expect } from "vitest";
import { logCompletion } from "../../../src/pipeline/stages/logCompletion.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("logCompletion stage", () => {
  it("marks the job completed with full progress", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });

    await logCompletion(makeContext(app, job, { destinationPath: "/library/movies/Movie/Movie.mkv" }));

    const persisted = queue.getJob(job.id)!;
    expect(persisted.status).toBe("completed");
    expect(persisted.progress).toBe(1);
    expect(persisted.completedAt).not.toBeNull();
  });
});
