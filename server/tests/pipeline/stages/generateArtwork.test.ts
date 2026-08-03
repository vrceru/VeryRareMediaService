import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateArtwork } from "../../../src/pipeline/stages/generateArtwork.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

const originalFetch = global.fetch;

describe("generateArtwork stage", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-artwork-"));
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    await rm(workDir, { recursive: true, force: true });
  });

  it("skips when there's no organized item directory yet", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(generateArtwork(makeContext(app, job))).resolves.toBeUndefined();
  });

  it("skips when the metadata has no poster URL", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { organizedItemDir: workDir });
    await generateArtwork(ctx);
    await expect(access(join(workDir, "folder.jpg"))).rejects.toThrow();
  });

  it("downloads and saves the poster as folder.jpg when available", async () => {
    global.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as unknown as typeof fetch;

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, {
      organizedItemDir: workDir,
      metadata: { provider: "fake", externalId: "1", title: "Movie", genres: [], posterUrl: "https://x/poster.jpg" },
    });
    await generateArtwork(ctx);

    await expect(access(join(workDir, "folder.jpg"))).resolves.toBeUndefined();
  });
});
