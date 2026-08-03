import { describe, it, expect } from "vitest";
import { validateRequest } from "../../../src/pipeline/stages/validateRequest.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("validateRequest stage", () => {
  it("passes for a valid request", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Valid Movie" });
    await expect(validateRequest(makeContext(app, job))).resolves.toBeUndefined();
  });

  it("throws when the title is empty", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "   " });
    await expect(validateRequest(makeContext(app, job))).rejects.toThrow(PipelineStageError);
  });

  it("throws for an unsupported media type", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "X" });
    // Force an invalid mediaType past the TS type system, like a malformed API payload would.
    job.request.mediaType = "podcast" as never;
    await expect(validateRequest(makeContext(app, job))).rejects.toThrow(/Unsupported mediaType/);
  });

  it("throws for a negative season", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "X", season: -1 });
    await expect(validateRequest(makeContext(app, job))).rejects.toThrow(/season/);
  });
});
