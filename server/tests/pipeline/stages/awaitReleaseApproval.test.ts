import { describe, it, expect } from "vitest";
import { awaitReleaseApproval } from "../../../src/pipeline/stages/awaitReleaseApproval.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";
import type { ReleaseCandidate } from "../../../src/providers/download/types.js";

describe("awaitReleaseApproval stage", () => {
  it("throws when there are no candidates to hold", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(awaitReleaseApproval(makeContext(app, job, { releaseCandidates: [] }))).rejects.toThrow(
      PipelineStageError,
    );
  });

  it("pauses the job and persists the candidate list", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const candidates: ReleaseCandidate[] = [
      { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 1, qualityScore: 0.5, providerId: "x" },
    ];

    await awaitReleaseApproval(makeContext(app, job, { releaseCandidates: candidates }));

    const persisted = queue.getJob(job.id)!;
    expect(persisted.status).toBe("awaiting_release_approval");
    expect(persisted.releaseCandidates).toEqual(candidates);
  });
});
