import { describe, it, expect, vi, afterEach } from "vitest";
import { SabnzbdProvider } from "../../src/providers/download/sabnzbd/provider.js";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("SabnzbdProvider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("is not configured without SABnzbd credentials", () => {
    const provider = new SabnzbdProvider(undefined, undefined);
    expect(provider.isConfigured()).toBe(false);
  });

  it("is configured when SABnzbd credentials are present, independent of Newznab", () => {
    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    expect(provider.isConfigured()).toBe(true);
  });

  it("search throws a clear error when no Newznab indexer is configured", async () => {
    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    await expect(provider.search({ query: "Movie" })).rejects.toThrow(/No Newznab-compatible indexer/);
  });

  it("search maps Newznab results into ReleaseCandidates", async () => {
    const rss = `<rss><channel><item><title>Movie.2020.1080p-GROUP</title><enclosure url="https://indexer/f.nzb" length="500"/></item></channel></rss>`;
    global.fetch = vi.fn(async () => new Response(rss, { status: 200 })) as unknown as typeof fetch;

    const provider = new SabnzbdProvider(
      { url: "http://localhost:8080", apiKey: "sab-key" },
      { url: "https://indexer.example", apiKey: "nn-key" },
    );
    const results = await provider.search({ query: "Movie" });
    expect(results).toEqual([
      { id: "https://indexer/f.nzb", title: "Movie.2020.1080p-GROUP", sizeBytes: 500, qualityScore: 0.5, providerId: "sabnzbd" },
    ]);
  });

  it("addDownload delegates to SABnzbd addurl and returns the nzo_id", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ status: true, nzo_ids: ["nzo_1"] }),
    ) as unknown as typeof fetch;

    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    const ref = await provider.addDownload(
      { id: "https://indexer/f.nzb", title: "Movie", sizeBytes: 100, qualityScore: 0.5, providerId: "sabnzbd" },
      "/ignored/destination",
    );
    expect(ref).toBe("nzo_1");
  });

  it("getStatus reports downloading progress from the active queue", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        queue: { kbpersec: "1024", slots: [{ nzo_id: "nzo_1", filename: "Movie", status: "Downloading", percentage: "55", mb: "0", mbleft: "0" }] },
      }),
    ) as unknown as typeof fetch;

    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    const status = await provider.getStatus("nzo_1");
    expect(status.state).toBe("downloading");
    expect(status.progress).toBeCloseTo(0.55);
    expect(status.downloadSpeedBytesPerSec).toBe(1024 * 1024);
  });

  it("getStatus falls back to history when not in the active queue", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("mode=queue")) {
        return jsonResponse({ queue: { kbpersec: "0", slots: [] } });
      }
      return jsonResponse({
        history: { slots: [{ nzo_id: "nzo_1", name: "Movie", status: "Completed", storage: "/downloads/Movie", fail_message: "" }] },
      });
    }) as unknown as typeof fetch;

    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    const status = await provider.getStatus("nzo_1");
    expect(status.state).toBe("completed");
    expect(status.progress).toBe(1);
    expect(status.savePath).toBe("/downloads/Movie");
  });

  it("getStatus reports error state with the failure message from history", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("mode=queue")) return jsonResponse({ queue: { kbpersec: "0", slots: [] } });
      return jsonResponse({
        history: { slots: [{ nzo_id: "nzo_1", name: "Movie", status: "Failed", storage: "", fail_message: "Unpacking failed" }] },
      });
    }) as unknown as typeof fetch;

    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    const status = await provider.getStatus("nzo_1");
    expect(status.state).toBe("error");
    expect(status.errorMessage).toBe("Unpacking failed");
  });

  it("getStatus returns unknown when the ref isn't found anywhere", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("mode=queue")) return jsonResponse({ queue: { kbpersec: "0", slots: [] } });
      return jsonResponse({ history: { slots: [] } });
    }) as unknown as typeof fetch;

    const provider = new SabnzbdProvider({ url: "http://localhost:8080", apiKey: "key" }, undefined);
    const status = await provider.getStatus("nonexistent");
    expect(status.state).toBe("unknown");
  });

  it("throws when calling addDownload without SABnzbd configured", async () => {
    const provider = new SabnzbdProvider(undefined, undefined);
    await expect(
      provider.addDownload({ id: "x", title: "x", sizeBytes: 0, qualityScore: 0, providerId: "sabnzbd" }, "/tmp"),
    ).rejects.toThrow(/not configured/);
  });
});
