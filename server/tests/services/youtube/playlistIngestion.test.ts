import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig } from "../../../src/config/index.js";
import { createDb } from "../../../src/db/client.js";
import { createAppContext } from "../../../src/appContext.js";
import type { AppContext } from "../../../src/appContext.js";
import type { PlaylistSummary } from "../../../src/providers/download/youtube/client.js";

const resolvePlaylistMock = vi.fn<() => Promise<PlaylistSummary>>();

vi.mock("../../../src/providers/download/youtube/client.js", () => ({
  YtDlpClient: vi.fn().mockImplementation(() => ({
    resolvePlaylist: resolvePlaylistMock,
  })),
}));

const { ingestPlaylist, YoutubeIngestionDisabledError } = await import(
  "../../../src/services/youtube/playlistIngestion.js"
);
const { PlaylistRunTracker } = await import("../../../src/services/youtube/playlistRuns.js");

function threeTrackPlaylist(): PlaylistSummary {
  return {
    playlistId: "PLtest",
    playlistTitle: "Test Playlist",
    tracks: [
      { videoId: "v1", title: "Track One", url: "https://www.youtube.com/watch?v=v1" },
      { videoId: "v2", title: "Track Two", url: "https://www.youtube.com/watch?v=v2" },
      { videoId: "v3", title: "Track Three", url: "https://www.youtube.com/watch?v=v3" },
    ],
  };
}

describe("ingestPlaylist", () => {
  let app: AppContext;

  beforeEach(() => {
    resolvePlaylistMock.mockReset();
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      YOUTUBE_INGESTION_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    app = createAppContext(config, createDb(":memory:"));
  });

  it("throws when YouTube ingestion is disabled", async () => {
    const disabledConfig = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:" } as NodeJS.ProcessEnv);
    const disabledApp = createAppContext(disabledConfig, createDb(":memory:"));
    await expect(ingestPlaylist(disabledApp, "https://www.youtube.com/playlist?list=PLtest")).rejects.toThrow(
      YoutubeIngestionDisabledError,
    );
  });

  it("rejects a non-playlist URL", async () => {
    await expect(ingestPlaylist(app, "https://www.youtube.com/watch?v=abc123")).rejects.toThrow(
      /not a YouTube playlist URL/,
    );
  });

  it("enqueues one job per discovered track on first run", async () => {
    resolvePlaylistMock.mockResolvedValue(threeTrackPlaylist());

    const result = await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    expect(result.discovered).toBe(3);
    expect(result.enqueued).toBe(3);
    expect(result.skippedDuplicate).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.unaccountedFor).toEqual([]);
    expect(result.jobIds).toHaveLength(3);
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((j) => j.id)).toEqual(result.jobIds);
    expect(result.jobs.every((j) => typeof j.title === "string" && j.title.length > 0)).toBe(true);

    for (const jobId of result.jobIds) {
      const job = app.queue.getJob(jobId)!;
      expect(job.mediaType).toBe("music");
      expect(job.request.preferredProviderId).toBe("youtube");
    }
  });

  it("re-running the same playlist enqueues zero new tracks", async () => {
    resolvePlaylistMock.mockResolvedValue(threeTrackPlaylist());
    await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    resolvePlaylistMock.mockResolvedValue(threeTrackPlaylist());
    const second = await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    expect(second.discovered).toBe(3);
    expect(second.enqueued).toBe(0);
    expect(second.skippedDuplicate).toBe(3);
  });

  it("a newly-added track results in exactly one new enqueue", async () => {
    resolvePlaylistMock.mockResolvedValue(threeTrackPlaylist());
    await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    const withFourthTrack: PlaylistSummary = {
      ...threeTrackPlaylist(),
      tracks: [
        ...threeTrackPlaylist().tracks,
        { videoId: "v4", title: "Track Four", url: "https://www.youtube.com/watch?v=v4" },
      ],
    };
    resolvePlaylistMock.mockResolvedValue(withFourthTrack);
    const second = await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    expect(second.discovered).toBe(4);
    expect(second.enqueued).toBe(1);
    expect(second.skippedDuplicate).toBe(3);
  });

  it("one track's enqueue failure doesn't stop the rest, and it's recorded", async () => {
    resolvePlaylistMock.mockResolvedValue(threeTrackPlaylist());
    const enqueueSpy = vi.spyOn(app.queue, "enqueue").mockImplementation((request) => {
      if (request.title === "Track Two") throw new Error("simulated enqueue failure");
      return {
        id: `job-${request.title}`,
        status: "pending",
        stage: "received",
        mediaType: request.mediaType ?? null,
        title: request.title,
        request,
        selectedRelease: null,
        releaseCandidates: null,
        metadata: null,
        primaryMediaFile: null,
        mediaFiles: null,
        deadReleaseIds: null,
        downloadProviderId: null,
        downloadRef: null,
        progress: 0,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 3,
        nextAttemptAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        startedAt: null,
        completedAt: null,
      };
    });

    const result = await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    expect(result.enqueued).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failures[0]!.videoId).toBe("v2");
    expect(result.failures[0]!.reason).toMatch(/simulated enqueue failure/);
    expect(result.unaccountedFor).toEqual([]);

    enqueueSpy.mockRestore();
  });

  it("records a run that can be retrieved afterward", async () => {
    resolvePlaylistMock.mockResolvedValue(threeTrackPlaylist());
    const result = await ingestPlaylist(app, "https://www.youtube.com/playlist?list=PLtest");

    const runs = new PlaylistRunTracker(app.db);
    const run = runs.get(result.runId)!;
    expect(run.discovered).toBe(3);
    expect(run.enqueued).toBe(3);
    expect(run.jobIds).toEqual(result.jobIds);
    expect(run.finishedAt).not.toBeNull();
  });
});
