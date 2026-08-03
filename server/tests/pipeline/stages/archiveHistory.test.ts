import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveHistory } from "../../../src/pipeline/stages/archiveHistory.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("archiveHistory stage", () => {
  let downloadTempDir: string;

  beforeEach(async () => {
    downloadTempDir = await mkdtemp(join(tmpdir(), "vrms-archive-history-"));
  });

  afterEach(async () => {
    await rm(downloadTempDir, { recursive: true, force: true });
  });

  it("removes the job's temp directory and appends a closing history entry", async () => {
    const { app, queue } = createTestApp({ downloadTempDir });
    const job = createRunningJob(queue, { title: "Movie" });

    const jobTempDir = join(downloadTempDir, job.id);
    await mkdir(jobTempDir, { recursive: true });
    await writeFile(join(jobTempDir, "leftover.mkv"), "content");

    await archiveHistory(makeContext(app, job));

    await expect(access(jobTempDir)).rejects.toThrow();

    const history = queue.getHistory(job.id);
    expect(history.at(-1)?.stage).toBe("archive");
    expect(history.at(-1)?.status).toBe("completed");
  });

  it("doesn't throw when the temp directory never existed", async () => {
    const { app, queue } = createTestApp({ downloadTempDir });
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(archiveHistory(makeContext(app, job))).resolves.toBeUndefined();
  });
});
