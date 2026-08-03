import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// These tests exercise real HTTP streaming against a local server bound to 127.0.0.1 — exactly
// what security/ssrfGuard.ts is designed to reject in production. Mocking it here is the
// correct call: a real deployment points this provider at a genuine public URL, and the guard's
// own blocking logic already has dedicated coverage in tests/security/ssrfGuard.test.ts.
vi.mock("../../src/security/ssrfGuard.js", () => ({
  assertPublicHttpUrl: vi.fn(async () => undefined),
  SsrfError: class SsrfError extends Error {},
}));

import { DirectDownloadProvider } from "../../src/providers/download/directDownload/provider.js";
import type { ReleaseCandidate } from "../../src/providers/download/types.js";

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

async function waitForTerminalStatus(
  provider: InstanceType<typeof DirectDownloadProvider>,
  ref: string,
  maxWaitMs = 8000,
) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const status = await provider.getStatus(ref);
    if (status.state === "completed" || status.state === "error") return status;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out waiting for terminal download status");
}

describe("DirectDownloadProvider", () => {
  let workDir: string;
  let server: Server | undefined;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-direct-dl-"));
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server!.close(resolve));
    }
    server = undefined;
    await rm(workDir, { recursive: true, force: true });
  });

  it("is always configured (no credentials required)", () => {
    const provider = new DirectDownloadProvider();
    expect(provider.isConfigured()).toBe(true);
  });

  it("search returns a single candidate when the query is a URL", async () => {
    const provider = new DirectDownloadProvider();
    const results = await provider.search({ query: "https://example.com/path/movie.mkv" });
    expect(results).toEqual([
      { id: "https://example.com/path/movie.mkv", title: "movie.mkv", sizeBytes: 0, qualityScore: 0.5, providerId: "direct-download" },
    ]);
  });

  it("search returns nothing for a plain-text query", async () => {
    const provider = new DirectDownloadProvider();
    expect(await provider.search({ query: "Some Movie Title" })).toEqual([]);
  });

  it("downloads a well-behaved response to disk and reports completion", async () => {
    const content = Buffer.from("hello world, this is the file content");
    server = createServer((req, res) => {
      res.writeHead(200, { "Content-Length": String(content.length) });
      res.end(content);
    });
    const port = await listen(server);

    const provider = new DirectDownloadProvider();
    const release: ReleaseCandidate = {
      id: `http://127.0.0.1:${port}/movie.mkv`,
      title: "movie.mkv",
      sizeBytes: content.length,
      qualityScore: 0.5,
      providerId: provider.id,
    };
    const ref = await provider.addDownload(release, workDir);
    const status = await waitForTerminalStatus(provider, ref);

    expect(status.state).toBe("completed");
    expect(status.progress).toBe(1);
    expect(status.savePath).toBe(workDir);

    const saved = await readFile(join(workDir, "movie.mkv"));
    expect(saved.equals(content)).toBe(true);
  });

  it("resumes via a Range request after the connection drops mid-transfer", async () => {
    const content = Buffer.from("A".repeat(2000) + "B".repeat(2000));
    let firstRequestSeen = false;

    server = createServer((req, res) => {
      if (!firstRequestSeen) {
        firstRequestSeen = true;
        res.writeHead(200, { "Content-Length": String(content.length) });
        res.write(content.subarray(0, 2000));
        req.socket.destroy(); // simulate a dropped connection partway through
        return;
      }
      const range = /bytes=(\d+)-/.exec(req.headers.range ?? "");
      const start = range ? Number(range[1]) : 0;
      const remaining = content.subarray(start);
      res.writeHead(206, {
        "Content-Length": String(remaining.length),
        "Content-Range": `bytes ${start}-${content.length - 1}/${content.length}`,
      });
      res.end(remaining);
    });
    const port = await listen(server);

    const provider = new DirectDownloadProvider();
    const release: ReleaseCandidate = {
      id: `http://127.0.0.1:${port}/movie.mkv`,
      title: "movie.mkv",
      sizeBytes: content.length,
      qualityScore: 0.5,
      providerId: provider.id,
    };
    const ref = await provider.addDownload(release, workDir);
    const status = await waitForTerminalStatus(provider, ref, 10000);

    expect(status.state).toBe("completed");
    const saved = await readFile(join(workDir, "movie.mkv"));
    expect(saved.equals(content)).toBe(true);
  }, 15000);

  it("reports an error status when the download is cancelled", async () => {
    server = createServer((req, res) => {
      res.writeHead(200, { "Content-Length": "1000000" });
      // Stream slowly so there's time to cancel mid-transfer.
      const interval = setInterval(() => {
        if (!res.write(Buffer.alloc(1000))) {
          clearInterval(interval);
        }
      }, 20);
      req.on("close", () => clearInterval(interval));
    });
    const port = await listen(server);

    const provider = new DirectDownloadProvider();
    const release: ReleaseCandidate = {
      id: `http://127.0.0.1:${port}/big.mkv`,
      title: "big.mkv",
      sizeBytes: 1_000_000,
      qualityScore: 0.5,
      providerId: provider.id,
    };
    const ref = await provider.addDownload(release, workDir);
    await new Promise((r) => setTimeout(r, 100));
    await provider.cancel(ref);

    const status = await waitForTerminalStatus(provider, ref);
    expect(status.state).toBe("error");
    expect(status.errorMessage).toMatch(/cancelled/i);
  });

  it("getStatus reports unknown for an unrecognized ref", async () => {
    const provider = new DirectDownloadProvider();
    const status = await provider.getStatus("nonexistent-ref");
    expect(status.state).toBe("unknown");
  });
});
