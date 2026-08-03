import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/index.js";
import { createDb } from "../../src/db/client.js";
import { createAppContext } from "../../src/appContext.js";
import { buildServer } from "../../src/api/server.js";
import type { AppContext } from "../../src/appContext.js";

describe("Approvals API", () => {
  let app: FastifyInstance;
  let ctx: AppContext;
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-approvals-api-"));
    const config = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:" } as NodeJS.ProcessEnv);
    config.storage.libraryDirs.movie = join(workDir, "library", "movies");
    ctx = createAppContext(config, createDb(":memory:"));
    app = await buildServer(ctx);
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  describe("release gate", () => {
    it("GET /api/approvals/releases lists held jobs with parsed candidate info", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      const candidates = [
        { id: "a", title: "Movie.2020.1080p.BluRay-GROUP", sizeBytes: 1, qualityScore: 0.8, providerId: "x" },
        { id: "b", title: "Movie.2020.720p.WEBRip-GROUP", sizeBytes: 1, qualityScore: 0.5, providerId: "x" },
      ];
      ctx.queue.setSelectedRelease(job.id, candidates[0]!);
      ctx.queue.holdForReleaseApproval(job.id, candidates);

      const res = await app.inject({ method: "GET", url: "/api/approvals/releases" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].autoSelectedId).toBe("a");
      expect(body[0].candidates).toHaveLength(2);
      expect(body[0].candidates[0].parsed.resolution).toBe("1080p");
    });

    it("POST approve-release keeps the auto-selected release by default", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      const candidate = { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 1, qualityScore: 0.8, providerId: "x" };
      ctx.queue.setSelectedRelease(job.id, candidate);
      ctx.queue.holdForReleaseApproval(job.id, [candidate]);

      const res = await app.inject({ method: "POST", url: `/api/jobs/${job.id}/approve-release`, payload: {} });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("pending");
      expect(body.stage).toBe("download");
      expect(body.selectedRelease.id).toBe("a");
    });

    it("POST approve-release switches to a different candidateId", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      const candidates = [
        { id: "a", title: "Movie.2020.480p-GROUP", sizeBytes: 1, qualityScore: 0.8, providerId: "x" },
        { id: "b", title: "Movie.2020.2160p.BluRay-GROUP", sizeBytes: 1, qualityScore: 0.5, providerId: "x" },
      ];
      ctx.queue.setSelectedRelease(job.id, candidates[0]!);
      ctx.queue.holdForReleaseApproval(job.id, candidates);

      const res = await app.inject({
        method: "POST",
        url: `/api/jobs/${job.id}/approve-release`,
        payload: { candidateId: "b" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().selectedRelease.id).toBe("b");
    });

    it("POST approve-release with an unknown candidateId returns 400", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      const candidate = { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 1, qualityScore: 0.8, providerId: "x" };
      ctx.queue.setSelectedRelease(job.id, candidate);
      ctx.queue.holdForReleaseApproval(job.id, [candidate]);

      const res = await app.inject({
        method: "POST",
        url: `/api/jobs/${job.id}/approve-release`,
        payload: { candidateId: "does-not-exist" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("POST approve-release on a job not awaiting approval returns 400", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      const res = await app.inject({ method: "POST", url: `/api/jobs/${job.id}/approve-release`, payload: {} });
      expect(res.statusCode).toBe(400);
    });

    it("POST approve-release on an unknown job returns 404", async () => {
      const res = await app.inject({ method: "POST", url: "/api/jobs/does-not-exist/approve-release", payload: {} });
      expect(res.statusCode).toBe(404);
    });

    it("POST deny-release cancels the job", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      ctx.queue.holdForReleaseApproval(job.id, []);

      const res = await app.inject({ method: "POST", url: `/api/jobs/${job.id}/deny-release` });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("cancelled");
    });
  });

  describe("final gate", () => {
    it("GET /api/approvals/final includes metadata and a storage check", async () => {
      await mkdir(join(workDir, "library", "movies"), { recursive: true });
      const filePath = join(workDir, "movie.mkv");
      await writeFile(filePath, Buffer.alloc(1024));

      const job = ctx.queue.enqueue({ title: "Movie", mediaType: "movie" });
      ctx.queue.setMediaType(job.id, "movie");
      ctx.queue.holdForFinalApproval(
        job.id,
        { provider: "fake", externalId: "1", title: "Movie", genres: [] },
        filePath,
      );

      const res = await app.inject({ method: "GET", url: "/api/approvals/final" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].metadata.title).toBe("Movie");
      expect(body[0].storage.hasEnoughSpace).toBe(true);
    });

    it("POST approve-final resumes at rename_files", async () => {
      const job = ctx.queue.enqueue({ title: "Movie", mediaType: "movie" });
      ctx.queue.setMediaType(job.id, "movie");
      ctx.queue.holdForFinalApproval(
        job.id,
        { provider: "fake", externalId: "1", title: "Movie", genres: [] },
        "/downloads/movie.mkv",
      );

      const res = await app.inject({ method: "POST", url: `/api/jobs/${job.id}/approve-final` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("pending");
      expect(body.stage).toBe("rename_files");
    });

    it("POST deny-final cancels the job", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      ctx.queue.holdForFinalApproval(
        job.id,
        { provider: "fake", externalId: "1", title: "Movie", genres: [] },
        "/downloads/movie.mkv",
      );

      const res = await app.inject({ method: "POST", url: `/api/jobs/${job.id}/deny-final` });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("cancelled");
    });

    it("POST approve-final on a job not awaiting final approval returns 400", async () => {
      const job = ctx.queue.enqueue({ title: "Movie" });
      const res = await app.inject({ method: "POST", url: `/api/jobs/${job.id}/approve-final` });
      expect(res.statusCode).toBe(400);
    });
  });
});
