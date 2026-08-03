import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "../../src/config/index.js";
import { createDb } from "../../src/db/client.js";
import { createAppContext } from "../../src/appContext.js";
import { buildServer } from "../../src/api/server.js";

describe("API routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const config = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:" } as NodeJS.ProcessEnv);
    const db = createDb(":memory:");
    const ctx = createAppContext(config, db);
    app = await buildServer(ctx);
  });

  it("GET /api/health reports integration status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.integrations.qbittorrent).toBe(false);
  });

  it("POST /api/queue creates a job and GET /api/queue lists it", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/queue",
      payload: { title: "Test Movie", mediaType: "movie" },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.status).toBe("pending");

    const listRes = await app.inject({ method: "GET", url: "/api/queue" });
    expect(listRes.statusCode).toBe(200);
    const jobs = listRes.json();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(created.id);
  });

  it("POST /api/queue rejects an empty title with 400", async () => {
    const res = await app.inject({ method: "POST", url: "/api/queue", payload: { title: "" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ValidationError");
  });

  it("GET /api/jobs/:id returns 404 for an unknown job", async () => {
    const res = await app.inject({ method: "GET", url: "/api/jobs/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/jobs/:id/history returns the job's stage history", async () => {
    const createRes = await app.inject({ method: "POST", url: "/api/queue", payload: { title: "X" } });
    const { id } = createRes.json();

    const res = await app.inject({ method: "GET", url: `/api/jobs/${id}/history` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("POST /api/jobs/:id/cancel transitions a pending job to cancelled", async () => {
    const createRes = await app.inject({ method: "POST", url: "/api/queue", payload: { title: "X" } });
    const { id } = createRes.json();

    const res = await app.inject({ method: "POST", url: `/api/jobs/${id}/cancel` });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("cancelled");
  });

  it("GET /api/config never exposes secret values", async () => {
    const res = await app.inject({ method: "GET", url: "/api/config" });
    const body = JSON.stringify(res.json());
    expect(body).not.toContain("password");
    expect(body.toLowerCase()).not.toContain("apikey");
  });

  it("GET /api/stats returns queue status and storage usage shape", async () => {
    const res = await app.inject({ method: "GET", url: "/api/stats" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("queueStatus");
    expect(body).toHaveProperty("storageUsageBytes");
    expect(body).toHaveProperty("recentActivity");
  });

  it("POST /api/library/refresh returns 400 when Jellyfin isn't configured", async () => {
    const res = await app.inject({ method: "POST", url: "/api/library/refresh" });
    expect(res.statusCode).toBe(400);
  });
});
