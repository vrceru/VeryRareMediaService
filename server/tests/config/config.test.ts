import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../../src/config/index.js";

const BASE_ENV = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("applies sensible defaults when no env vars are set", () => {
    const config = loadConfig(BASE_ENV);
    expect(config.server.port).toBe(8787);
    expect(config.queue.concurrency).toBe(2);
    expect(config.virusScan.enabled).toBe(false);
    expect(config.qbittorrent).toBeUndefined();
    expect(config.tmdb).toBeUndefined();
  });

  it("leaves optional integrations undefined instead of defaulting secrets", () => {
    const config = loadConfig({ ...BASE_ENV, QBITTORRENT_URL: "http://localhost:8080" });
    // Missing username/password means the integration as a whole is not considered configured.
    expect(config.qbittorrent).toBeUndefined();
  });

  it("builds a full qbittorrent config only when all three fields are present", () => {
    const config = loadConfig({
      ...BASE_ENV,
      QBITTORRENT_URL: "http://localhost:8080",
      QBITTORRENT_USERNAME: "admin",
      QBITTORRENT_PASSWORD: "secret",
    });
    expect(config.qbittorrent).toEqual({
      url: "http://localhost:8080",
      username: "admin",
      password: "secret",
    });
  });

  it("throws a ConfigError with readable messages on invalid values", () => {
    expect(() => loadConfig({ ...BASE_ENV, PORT: "not-a-number" })).toThrow(ConfigError);
  });

  it("parses the webhook URL list from a comma-separated string", () => {
    const config = loadConfig({
      ...BASE_ENV,
      NOTIFICATION_WEBHOOK_URLS: "https://a.example.com,https://b.example.com",
    });
    expect(config.webhookUrls).toEqual(["https://a.example.com", "https://b.example.com"]);
  });
});
