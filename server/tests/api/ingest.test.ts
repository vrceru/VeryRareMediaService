import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PlaylistSummary } from "../../src/providers/download/youtube/client.js";

const resolvePlaylistMock = vi.fn<() => Promise<PlaylistSummary>>();

vi.mock("../../src/providers/download/youtube/client.js", () => ({
  YtDlpClient: vi.fn().mockImplementation(() => ({
    resolvePlaylist: resolvePlaylistMock,
  })),
}));

const { loadConfig } = await import("../../src/config/index.js");
const { createDb } = await import("../../src/db/client.js");
const { createAppContext } = await import("../../src/appContext.js");
const { buildServer } = await import("../../src/api/server.js");
type AppContext = Awaited<ReturnType<typeof createAppContext>>;

function twoTrackPlaylist(): PlaylistSummary {
  return {
    playlistId: "PLtest",
    playlistTitle: "Test Playlist",
    tracks: [
      { videoId: "v1", title: "Track One", url: "https://www.youtube.com/watch?v=v1" },
      { videoId: "v2", title: "Track Two", url: "https://www.youtube.com/watch?v=v2" },
    ],
  };
}

describe("Ingest API", () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    resolvePlaylistMock.mockReset();
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      YOUTUBE_INGESTION_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    ctx = createAppContext(config, createDb(":memory:"));
    app = await buildServer(ctx);
  });

  it("POST /api/ingest/youtube enqueues discovered tracks and returns a summary", async () => {
    resolvePlaylistMock.mockResolvedValue(twoTrackPlaylist());

    const res = await app.inject({
      method: "POST",
      url: "/api/ingest/youtube",
      payload: { url: "https://www.youtube.com/playlist?list=PLtest" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.discovered).toBe(2);
    expect(body.enqueued).toBe(2);
    expect(body.jobIds).toHaveLength(2);
  });

  it("POST /api/ingest/youtube rejects a non-YouTube URL with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/ingest/youtube",
      payload: { url: "https://vimeo.com/playlist?list=abc" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/ingest/youtube returns 400 when the feature is disabled", async () => {
    const disabledConfig = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:" } as NodeJS.ProcessEnv);
    const disabledCtx = createAppContext(disabledConfig, createDb(":memory:"));
    const disabledApp = await buildServer(disabledCtx);

    const res = await disabledApp.inject({
      method: "POST",
      url: "/api/ingest/youtube",
      payload: { url: "https://www.youtube.com/playlist?list=PLtest" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/ingest/youtube/:runId returns the run summary with live job status counts", async () => {
    resolvePlaylistMock.mockResolvedValue(twoTrackPlaylist());
    const createRes = await app.inject({
      method: "POST",
      url: "/api/ingest/youtube",
      payload: { url: "https://www.youtube.com/playlist?list=PLtest" },
    });
    const { runId } = createRes.json();

    const res = await app.inject({ method: "GET", url: `/api/ingest/youtube/${runId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.discovered).toBe(2);
    expect(body.liveCounts.pending).toBe(2);
  });

  it("GET /api/ingest/youtube/:runId returns 404 for an unknown run", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ingest/youtube/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/ingest/youtube/verify reports missing tracks not yet ingested", async () => {
    resolvePlaylistMock.mockResolvedValue(twoTrackPlaylist());

    const res = await app.inject({
      method: "GET",
      url: `/api/ingest/youtube/verify?url=${encodeURIComponent("https://www.youtube.com/playlist?list=PLtest")}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.liveTrackCount).toBe(2);
    expect(body.ingestedCount).toBe(0);
    expect(body.missingTracks).toHaveLength(2);
  });

  it("GET /api/ingest/youtube/verify reports nothing missing after ingestion", async () => {
    resolvePlaylistMock.mockResolvedValue(twoTrackPlaylist());
    await app.inject({
      method: "POST",
      url: "/api/ingest/youtube",
      payload: { url: "https://www.youtube.com/playlist?list=PLtest" },
    });

    resolvePlaylistMock.mockResolvedValue(twoTrackPlaylist());
    const res = await app.inject({
      method: "GET",
      url: `/api/ingest/youtube/verify?url=${encodeURIComponent("https://www.youtube.com/playlist?list=PLtest")}`,
    });

    const body = res.json();
    expect(body.missingTracks).toHaveLength(0);
    expect(body.ingestedCount).toBe(2);
  });
});
