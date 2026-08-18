import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(): void {
    this.killed = true;
    this.emit("close", null);
  }
}

let lastSpawned: FakeChildProcess | undefined;

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    lastSpawned = new FakeChildProcess();
    return lastSpawned;
  }),
  execFile: vi.fn(),
}));

import { YoutubeProvider } from "../../../src/providers/download/youtube/provider.js";

describe("YoutubeProvider", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-youtube-provider-"));
    lastSpawned = undefined;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(workDir, { recursive: true, force: true });
  });

  it("is not configured without YOUTUBE_INGESTION_ENABLED", () => {
    const provider = new YoutubeProvider(undefined);
    expect(provider.isConfigured()).toBe(false);
  });

  it("is configured when given a binary path + audio format", () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    expect(provider.isConfigured()).toBe(true);
  });

  it("search returns a single candidate for a video URL", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    const results = await provider.search({ query: "https://www.youtube.com/watch?v=abc123" });
    expect(results).toHaveLength(1);
    expect(results[0]!.dedupeKey).toBe("abc123");
    expect(results[0]!.providerId).toBe("youtube");
  });

  it("search returns nothing for a playlist URL (playlists are resolved separately)", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    const results = await provider.search({ query: "https://www.youtube.com/playlist?list=PLxyz" });
    expect(results).toEqual([]);
  });

  it("search returns nothing for a non-YouTube URL rather than throwing", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    expect(await provider.search({ query: "https://vimeo.com/123" })).toEqual([]);
  });

  it("addDownload reports progress and completion via getStatus", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    const ref = await provider.addDownload(
      { id: "https://www.youtube.com/watch?v=abc123", title: "x", sizeBytes: 0, qualityScore: 0.5, providerId: "youtube" },
      workDir,
    );

    expect(lastSpawned).toBeDefined();
    lastSpawned!.stdout.emit("data", Buffer.from("[download]  42.0% of 3.50MiB\n"));
    let status = await provider.getStatus(ref);
    expect(status.state).toBe("downloading");
    expect(status.progress).toBeCloseTo(0.42, 2);

    lastSpawned!.emit("close", 0);
    status = await provider.getStatus(ref);
    expect(status.state).toBe("completed");
    expect(status.progress).toBe(1);
    expect(status.savePath).toBe(workDir);
  });

  it("addDownload reports an error status on a non-zero exit code", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    const ref = await provider.addDownload(
      { id: "https://www.youtube.com/watch?v=abc123", title: "x", sizeBytes: 0, qualityScore: 0.5, providerId: "youtube" },
      workDir,
    );

    lastSpawned!.stderr.emit("data", Buffer.from("ERROR: Video unavailable\n"));
    lastSpawned!.emit("close", 1);

    const status = await provider.getStatus(ref);
    expect(status.state).toBe("error");
    expect(status.errorMessage).toMatch(/Video unavailable/);
  });

  it("cancel kills the underlying process", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    const ref = await provider.addDownload(
      { id: "https://www.youtube.com/watch?v=abc123", title: "x", sizeBytes: 0, qualityScore: 0.5, providerId: "youtube" },
      workDir,
    );
    await provider.cancel(ref);
    expect(lastSpawned!.killed).toBe(true);
  });

  it("getStatus reports unknown for an unrecognized ref", async () => {
    const provider = new YoutubeProvider({ binaryPath: "yt-dlp", audioFormat: "best" });
    const status = await provider.getStatus("nonexistent");
    expect(status.state).toBe("unknown");
  });

  it("addDownload throws when the provider isn't configured", async () => {
    const provider = new YoutubeProvider(undefined);
    await expect(
      provider.addDownload(
        { id: "https://www.youtube.com/watch?v=abc123", title: "x", sizeBytes: 0, qualityScore: 0.5, providerId: "youtube" },
        workDir,
      ),
    ).rejects.toThrow(/not configured/);
  });
});
