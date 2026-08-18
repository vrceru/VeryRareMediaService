import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPipeline } from "../../src/pipeline/runner.js";
import { approveRelease, approveFinal } from "../../src/pipeline/approvals.js";
import { jobTempDir } from "../../src/services/cleanup/tempStorage.js";
import { createTestApp, createRunningJob, FakeDownloadProvider, FakeMetadataProvider } from "./fixtures.js";
import type { ScanResult, VirusScanner } from "../../src/services/virusscan/types.js";

class RecordingScanner implements VirusScanner {
  scannedFiles: string[] = [];
  isEnabled(): boolean {
    return true;
  }
  async scanFile(filePath: string): Promise<ScanResult> {
    this.scannedFiles.push(filePath);
    return { clean: true };
  }
}

describe("runPipeline (integration)", () => {
  let workDir: string;
  let downloadTempDir: string;
  let libraryDirs: { movie: string; show: string; anime: string; music: string };

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-runner-"));
    downloadTempDir = join(workDir, "downloads");
    libraryDirs = {
      movie: join(workDir, "library", "movies"),
      show: join(workDir, "library", "shows"),
      anime: join(workDir, "library", "anime"),
      music: join(workDir, "library", "music"),
    };
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("pauses at the release-approval gate instead of downloading automatically", async () => {
    const downloadProvider = new FakeDownloadProvider();
    downloadProvider.searchResults = [
      {
        id: "magnet:?xt=urn:btih:abc",
        title: "Movie Title.2020.1080p.BluRay.x264-GROUP",
        sizeBytes: 30 * 1024 * 1024,
        seeders: 50,
        qualityScore: 0.8,
        providerId: downloadProvider.id,
      },
    ];
    const { app, queue } = createTestApp({ downloadProvider, downloadTempDir, libraryDirs });
    const job = createRunningJob(queue, { title: "Movie Title", mediaType: "movie", year: 2020 });

    await runPipeline(app, job);

    const paused = queue.getJob(job.id)!;
    expect(paused.status).toBe("awaiting_release_approval");
    expect(paused.releaseCandidates).toHaveLength(1);
    expect(downloadProvider.addedRefs).toHaveLength(0); // never actually started downloading
  });

  it(
    "runs a movie request end-to-end through both approval gates: download -> identify -> metadata -> organize -> complete",
    async () => {
      const downloadProvider = new FakeDownloadProvider();
      downloadProvider.searchResults = [
        {
          id: "magnet:?xt=urn:btih:abc",
          title: "Movie Title.2020.1080p.BluRay.x264-GROUP",
          sizeBytes: 30 * 1024 * 1024,
          seeders: 50,
          qualityScore: 0.8,
          providerId: downloadProvider.id,
        },
      ];

      const metadataProvider = new FakeMetadataProvider("movie");
      metadataProvider.searchResults = [{ externalId: "1", title: "Movie Title", year: 2020 }];
      metadataProvider.details = {
        provider: "fake-movie",
        externalId: "1",
        title: "Movie Title",
        year: 2020,
        genres: [],
      };

      const { app, queue } = createTestApp({
        downloadProvider,
        metadataProvider,
        downloadTempDir,
        libraryDirs,
      });

      const job = createRunningJob(queue, { title: "Movie Title", mediaType: "movie", year: 2020 });

      const tempDir = jobTempDir(downloadTempDir, job.id);
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, "movie.mkv"), Buffer.alloc(30 * 1024 * 1024));
      downloadProvider.statusSequence = [
        { state: "completed", progress: 1, downloadSpeedBytesPerSec: 0, savePath: tempDir },
      ];

      // First run: stops at Gate A.
      await runPipeline(app, job);
      expect(queue.getJob(job.id)?.status).toBe("awaiting_release_approval");

      // Admin approves the auto-selected release (no candidateId override).
      approveRelease(app, queue.getJob(job.id)!);
      expect(queue.getJob(job.id)?.status).toBe("pending");
      expect(queue.getJob(job.id)?.stage).toBe("download");

      // Second run: downloads, verifies, scans, extracts, identifies, fetches metadata, stops at Gate B.
      await runPipeline(app, queue.getJob(job.id)!);
      const beforeFinal = queue.getJob(job.id)!;
      expect(beforeFinal.status).toBe("awaiting_final_approval");
      expect(beforeFinal.metadata?.title).toBe("Movie Title");
      expect(beforeFinal.primaryMediaFile).toContain("movie.mkv");

      // Admin approves final review.
      approveFinal(app, beforeFinal);
      expect(queue.getJob(job.id)?.stage).toBe("rename_files");

      // Third run: organizes into the library and completes.
      await runPipeline(app, queue.getJob(job.id)!);

      const finalJob = queue.getJob(job.id)!;
      expect(finalJob.status).toBe("completed");
      expect(finalJob.progress).toBe(1);

      const expectedPath = join(libraryDirs.movie, "Movie Title (2020)", "Movie Title (2020).mkv");
      await expect(access(expectedPath)).resolves.toBeUndefined();
      await expect(access(tempDir)).rejects.toThrow();
    },
  );

  it(
    "carries every file of a batch (season-pack) release through the final-approval gate, not just the primary one",
    async () => {
      // Regression test: mediaFiles previously lived only in in-memory pipeline state, so a
      // job that paused at the final-approval gate and resumed later (as every real job does)
      // lost every file except the one primaryMediaFile already persisted — organizing just
      // one episode out of a whole season pack.
      const downloadProvider = new FakeDownloadProvider();
      downloadProvider.searchResults = [
        {
          id: "magnet:?xt=urn:btih:abc",
          title: "Show.Name.S01.1080p.WEB-DL-GROUP",
          sizeBytes: 63 * 1024 * 1024,
          seeders: 50,
          qualityScore: 0.8,
          providerId: downloadProvider.id,
        },
      ];

      const metadataProvider = new FakeMetadataProvider("show");
      metadataProvider.searchResults = [{ externalId: "1", title: "Show Name" }];
      metadataProvider.details = { provider: "fake-show", externalId: "1", title: "Show Name", genres: [] };

      const { app, queue } = createTestApp({
        downloadProvider,
        metadataProvider,
        downloadTempDir,
        libraryDirs,
      });

      const job = createRunningJob(queue, { title: "Show Name", mediaType: "show" });

      const tempDir = jobTempDir(downloadTempDir, job.id);
      await mkdir(tempDir, { recursive: true });
      const episodeFiles = ["Show.Name.S01E01.mkv", "Show.Name.S01E02.mkv", "Show.Name.S01E03.mkv"];
      for (const f of episodeFiles) await writeFile(join(tempDir, f), Buffer.alloc(21 * 1024 * 1024));
      downloadProvider.statusSequence = [
        { state: "completed", progress: 1, downloadSpeedBytesPerSec: 0, savePath: tempDir },
      ];

      await runPipeline(app, job); // Gate A
      approveRelease(app, queue.getJob(job.id)!);

      await runPipeline(app, queue.getJob(job.id)!); // Gate B
      const beforeFinal = queue.getJob(job.id)!;
      expect(beforeFinal.status).toBe("awaiting_final_approval");
      expect(beforeFinal.mediaFiles).toHaveLength(3);

      approveFinal(app, beforeFinal);
      // Simulate a real resume: re-fetch the job from the DB rather than reusing the in-memory
      // object, so this test can't accidentally pass off of in-process state runPipeline never
      // actually persisted.
      await runPipeline(app, queue.getJob(job.id)!);

      const finalJob = queue.getJob(job.id)!;
      expect(finalJob.status).toBe("completed");

      for (let i = 1; i <= 3; i++) {
        const expected = join(libraryDirs.show, "Show Name", "Season 01", `Show Name - S01E0${i}.mkv`);
        await expect(access(expected)).resolves.toBeUndefined();
      }
    },
  );

  it(
    "a YouTube-sourced job goes through virus scan and both approval gates like any other job — nothing is bypassed",
    async () => {
      const youtubeProvider = new FakeDownloadProvider("youtube");
      const videoUrl = "https://www.youtube.com/watch?v=v1";
      youtubeProvider.searchResults = [
        {
          id: videoUrl,
          title: "Some Artist - Some Song (Official Audio)",
          sizeBytes: 3 * 1024 * 1024,
          qualityScore: 0.5,
          providerId: "youtube",
          dedupeKey: "v1",
        },
      ];

      const metadataProvider = new FakeMetadataProvider("music");
      metadataProvider.searchResults = [{ externalId: "1", title: "Some Song", artist: "Some Artist" }];
      metadataProvider.details = {
        provider: "fake-music",
        externalId: "1",
        title: "Some Song",
        artist: "Some Artist",
        album: "Some Album",
        genres: [],
      };

      const scanner = new RecordingScanner();
      const { app, queue } = createTestApp({
        downloadProvider: youtubeProvider,
        metadataProvider,
        downloadTempDir,
        libraryDirs,
        virusScanner: scanner,
      });

      const job = createRunningJob(queue, {
        title: "Some Artist - Some Song (Official Audio)",
        mediaType: "music",
        searchQuery: videoUrl,
        preferredProviderId: "youtube",
      });

      const tempDir = jobTempDir(downloadTempDir, job.id);
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, "v1.m4a"), Buffer.alloc(3 * 1024 * 1024));
      youtubeProvider.statusSequence = [
        { state: "completed", progress: 1, downloadSpeedBytesPerSec: 0, savePath: tempDir },
      ];

      await runPipeline(app, job);
      expect(queue.getJob(job.id)?.status).toBe("awaiting_release_approval");
      approveRelease(app, queue.getJob(job.id)!);

      await runPipeline(app, queue.getJob(job.id)!);
      const beforeFinal = queue.getJob(job.id)!;
      expect(beforeFinal.status).toBe("awaiting_final_approval");
      // Proves virus scanning actually ran against the downloaded file rather than being
      // skipped for this provider.
      expect(scanner.scannedFiles).toHaveLength(1);
      expect(scanner.scannedFiles[0]).toContain("v1.m4a");
      // Proves the confidence-scored music metadata match ran and picked the right candidate.
      expect(beforeFinal.metadata?.artist).toBe("Some Artist");
      expect(beforeFinal.metadata?.matchConfidence).toBeGreaterThanOrEqual(60);

      approveFinal(app, beforeFinal);
      await runPipeline(app, queue.getJob(job.id)!);

      const finalJob = queue.getJob(job.id)!;
      expect(finalJob.status).toBe("completed");
    },
  );

  it("stops at the failing stage and dispatches a processing.failed notification", async () => {
    // No download provider configured at all — fails at searchProviders.
    const { app, queue } = createTestApp({ downloadTempDir, libraryDirs });
    const job = createRunningJob(queue, { title: "Movie Title" });
    const dispatchSpy = vi.spyOn(app.notifications, "dispatch");

    await expect(runPipeline(app, job)).rejects.toThrow(/No download providers/);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "processing.failed" }),
    );

    // runPipeline itself doesn't touch job status on failure — that's JobWorker's job via
    // queue.failJob — so the job should still show as "running" here.
    expect(queue.getJob(job.id)?.status).toBe("running");
  });
});
