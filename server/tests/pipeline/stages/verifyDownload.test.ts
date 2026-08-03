import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDownload } from "../../../src/pipeline/stages/verifyDownload.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("verifyDownload stage", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-verify-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("throws when no download directory was recorded", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(verifyDownload(makeContext(app, job))).rejects.toThrow(/No download directory/);
  });

  it("throws when the directory has no files", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(
      verifyDownload(makeContext(app, job, { downloadSavePath: workDir })),
    ).rejects.toThrow(/no files/);
  });

  it("throws when a file is zero bytes", async () => {
    await writeFile(join(workDir, "movie.mkv"), "");
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(
      verifyDownload(makeContext(app, job, { downloadSavePath: workDir })),
    ).rejects.toThrow(/empty/);
  });

  it("recursively lists non-empty files and stores them in state", async () => {
    await mkdir(join(workDir, "subs"), { recursive: true });
    await writeFile(join(workDir, "movie.mkv"), "content");
    await writeFile(join(workDir, "subs", "movie.srt"), "1\nHi");

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { downloadSavePath: workDir });
    await verifyDownload(ctx);

    expect(ctx.state.mediaFiles).toHaveLength(2);
  });
});
