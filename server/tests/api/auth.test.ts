import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "../../src/config/index.js";
import { createDb } from "../../src/db/client.js";
import { createAppContext } from "../../src/appContext.js";
import { buildServer } from "../../src/api/server.js";

const TEST_KEY = "test-secret-key-12345";

describe("API authentication", () => {
  describe("when API_KEY is set", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      const config = loadConfig({
        NODE_ENV: "test",
        DATABASE_PATH: ":memory:",
        API_KEY: TEST_KEY,
      } as NodeJS.ProcessEnv);
      const ctx = createAppContext(config, createDb(":memory:"));
      app = await buildServer(ctx);
    });

    it("allows /api/health without a key", async () => {
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json().integrations.apiAuth).toBe(true);
    });

    it("rejects /api/queue with no key", async () => {
      const res = await app.inject({ method: "GET", url: "/api/queue" });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Unauthorized");
    });

    it("rejects a wrong key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/queue",
        headers: { authorization: "Bearer wrong-key" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("accepts the correct key via Authorization: Bearer", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/queue",
        headers: { authorization: `Bearer ${TEST_KEY}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts the correct key via X-Api-Key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/queue",
        headers: { "x-api-key": TEST_KEY },
      });
      expect(res.statusCode).toBe(200);
    });

    it("never leaks the key through /api/config", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/config",
        headers: { "x-api-key": TEST_KEY },
      });
      const body = JSON.stringify(res.json());
      expect(body).not.toContain(TEST_KEY);
    });
  });

  describe("when API_KEY is unset", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      const config = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:" } as NodeJS.ProcessEnv);
      const ctx = createAppContext(config, createDb(":memory:"));
      app = await buildServer(ctx);
    });

    it("allows requests through with no key at all", async () => {
      const res = await app.inject({ method: "GET", url: "/api/queue" });
      expect(res.statusCode).toBe(200);
    });

    it("reports apiAuth: false on /api/health", async () => {
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.json().integrations.apiAuth).toBe(false);
    });
  });
});
