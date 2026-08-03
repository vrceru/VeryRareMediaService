import { describe, it, expect } from "vitest";
import { awaitFinalApproval } from "../../../src/pipeline/stages/awaitFinalApproval.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";
import type { MediaMetadata } from "../../../src/providers/metadata/types.js";

describe("awaitFinalApproval stage", () => {
  it("throws when metadata or primaryMediaFile is missing", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(awaitFinalApproval(makeContext(app, job))).rejects.toThrow(PipelineStageError);
  });

  it("pauses the job and persists metadata + primary media file", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const metadata: MediaMetadata = { provider: "fake", externalId: "1", title: "Movie", genres: [] };

    await awaitFinalApproval(
      makeContext(app, job, { metadata, primaryMediaFile: "/downloads/movie.mkv" }),
    );

    const persisted = queue.getJob(job.id)!;
    expect(persisted.status).toBe("awaiting_final_approval");
    expect(persisted.metadata).toEqual(metadata);
    expect(persisted.primaryMediaFile).toBe("/downloads/movie.mkv");
  });
});
