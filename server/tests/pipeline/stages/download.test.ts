import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { download, hasSignOfLife } from "../../../src/pipeline/stages/download.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { JobCancelledError } from "../../../src/queue/types.js";
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

  it(
    "stops promptly when the job is cancelled mid-poll, instead of running until MAX_WAIT_MS",
    async () => {
      // Regression test: cancelJob() only flips the DB row -- nothing used to stop this loop,
      // so a job cancelled mid-download (e.g. its torrent got removed) would silently poll for
      // up to 6 hours, permanently occupying one of JobWorker's concurrency slots.
      const { app, queue } = createTestApp({ downloadTempDir: workDir });
      const job = createRunningJob(queue, { title: "Movie" });

      class CancellingProvider extends FakeDownloadProvider {
        statusCalls = 0;
        override async getStatus(ref: string) {
          this.statusCalls++;
          queue.cancelJob(job.id);
          return super.getStatus(ref);
        }
      }
      const provider = new CancellingProvider();
      provider.statusSequence = [
        { state: "downloading", progress: 0.1, downloadSpeedBytesPerSec: 1000, savePath: null },
        { state: "downloading", progress: 0.2, downloadSpeedBytesPerSec: 1000, savePath: null },
      ];

      const ctx = makeContext(app, job, { selectedRelease: release, downloadProvider: provider });
      await expect(download(ctx)).rejects.toThrow(JobCancelledError);
      // Stopped after the first poll's cancellation was noticed at the top of the next loop
      // iteration -- never reached a second getStatus() call.
      expect(provider.statusCalls).toBe(1);
    },
    15000,
  );
});

describe("hasSignOfLife", () => {
  const base = { state: "downloading" as const, progress: 0, downloadSpeedBytesPerSec: 0, savePath: null };

  it("is alive with actual progress, regardless of reported peers", () => {
    expect(hasSignOfLife({ ...base, progress: 0.01, connectedPeers: 0 })).toBe(true);
  });

  it("is alive with connected peers even at zero progress", () => {
    expect(hasSignOfLife({ ...base, progress: 0, connectedPeers: 1 })).toBe(true);
  });

  it("is dead at zero progress and zero connected peers", () => {
    // The exact bug hit in production: a release advertised with 5000+ seeders by the search
    // index but zero peers qBittorrent could actually reach.
    expect(hasSignOfLife({ ...base, progress: 0, connectedPeers: 0 })).toBe(false);
  });

  it("assumes healthy when the provider can't report peer counts at all", () => {
    expect(hasSignOfLife({ ...base, progress: 0, connectedPeers: undefined })).toBe(true);
  });
});
