import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateMedia } from "../../../src/pipeline/stages/validateMedia.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("validateMedia stage", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-validate-media-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("throws when no candidate file is valid", async () => {
    const tiny = join(workDir, "sample.mkv");
    await writeFile(tiny, Buffer.alloc(1024));

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(validateMedia(makeContext(app, job, { mediaFiles: [tiny] }))).rejects.toThrow(
      PipelineStageError,
    );
  });

  it("picks the largest valid file as the primary one", async () => {
    const small = join(workDir, "extra.mkv");
    const big = join(workDir, "movie.mkv");
    await writeFile(small, Buffer.alloc(21 * 1024 * 1024));
    await writeFile(big, Buffer.alloc(40 * 1024 * 1024));

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: [small, big] });
    await validateMedia(ctx);

    expect(ctx.state.primaryMediaFile).toBe(big);
    expect(ctx.state.mediaFiles).toHaveLength(2);
  });

  it("filters out invalid files while keeping valid ones", async () => {
    const junk = join(workDir, "notes.txt");
    const valid = join(workDir, "movie.mkv");
    await writeFile(junk, "not media");
    await writeFile(valid, Buffer.alloc(25 * 1024 * 1024));

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: [junk, valid] });
    await validateMedia(ctx);

    expect(ctx.state.mediaFiles).toEqual([valid]);
  });
});
