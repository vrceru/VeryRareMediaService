import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { download } from "../../../src/pipeline/stages/download.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext, FakeDownloadProvider } from "../fixtures.js";
import type { ReleaseCandidate } from "../../../src/providers/download/types.js";

const release: ReleaseCandidate = {
  id: "a",
  title: "Movie.2020.1080p-GROUP",
  sizeBytes: 1,
  qualityScore: 0.8,
  providerId: "fake-download",
};

describe("download stage", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-download-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("throws when no release/provider was selected", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(download(makeContext(app, job))).rejects.toThrow(PipelineStageError);
  });

  it("completes immediately when the provider reports completed on the first poll", async () => {
    const provider = new FakeDownloadProvider();
    provider.statusSequence = [
      { state: "completed", progress: 1, downloadSpeedBytesPerSec: 0, savePath: "/downloads/movie" },
    ];
    const { app, queue } = createTestApp({ downloadProvider: provider, downloadTempDir: workDir });
    const job = createRunningJob(queue, { title: "Movie" });

    const ctx = makeContext(app, job, { selectedRelease: release, downloadProvider: provider });
    await download(ctx);

    expect(ctx.state.downloadSavePath).toBe("/downloads/movie");
    expect(provider.addedRefs).toHaveLength(1);
  });

  it("throws when the provider reports an error state", async () => {
    const provider = new FakeDownloadProvider();
    provider.statusSequence = [
      { state: "error", progress: 0, downloadSpeedBytesPerSec: 0, savePath: null, errorMessage: "disk full" },
    ];
    const { app, queue } = createTestApp({ downloadProvider: provider, downloadTempDir: workDir });
    const job = createRunningJob(queue, { title: "Movie" });

    const ctx = makeContext(app, job, { selectedRelease: release, downloadProvider: provider });
    await expect(download(ctx)).rejects.toThrow(/disk full/);
  });

  it(
    "polls and updates job progress across multiple in-progress states before completing",
    async () => {
      // Real timers on purpose: download() awaits a real fs.mkdir (via ensureJobTempDir) before
      // it ever starts polling, which races unpredictably against vi.useFakeTimers()'s virtual
      // clock. Two real 3s poll intervals is a small, bounded price for a deterministic test.
      const provider = new FakeDownloadProvider();
      provider.statusSequence = [
        { state: "downloading", progress: 0.3, downloadSpeedBytesPerSec: 1000, savePath: null },
        { state: "downloading", progress: 0.7, downloadSpeedBytesPerSec: 1000, savePath: null },
        { state: "completed", progress: 1, downloadSpeedBytesPerSec: 0, savePath: "/downloads/movie" },
      ];
      const { app, queue } = createTestApp({ downloadProvider: provider, downloadTempDir: workDir });
      const job = createRunningJob(queue, { title: "Movie" });

      const ctx = makeContext(app, job, { selectedRelease: release, downloadProvider: provider });
      await download(ctx);

      const persisted = queue.getJob(job.id)!;
      expect(persisted.progress).toBe(1);
    },
    15000,
  );
});
