import { describe, it, expect } from "vitest";
import { searchProviders } from "../../../src/pipeline/stages/searchProviders.js";
import { createTestApp, createRunningJob, makeContext, FakeDownloadProvider } from "../fixtures.js";

describe("searchProviders stage", () => {
  it("throws when no download providers are configured", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(searchProviders(makeContext(app, job))).rejects.toThrow(/No download providers/);
  });

  it("throws when the configured provider returns no results", async () => {
    const provider = new FakeDownloadProvider();
    provider.searchResults = [];
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(searchProviders(makeContext(app, job))).rejects.toThrow(/No releases found/);
  });

  it("collects results into pipeline state on success", async () => {
    const provider = new FakeDownloadProvider();
    provider.searchResults = [
      { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 100, qualityScore: 0.8, providerId: provider.id },
    ];
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });

    const ctx = makeContext(app, job);
    await searchProviders(ctx);

    expect(ctx.state.releaseCandidates).toHaveLength(1);
    expect(ctx.state.releaseCandidates![0]!.title).toBe("Movie.2020.1080p-GROUP");
  });

  it("tolerates one provider throwing by treating it as zero results, not a hard failure", async () => {
    const provider = new FakeDownloadProvider();
    provider.search = async () => {
      throw new Error("indexer down");
    };
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });

    // With only one (failing) provider configured, zero total results still surfaces as the
    // "no releases found" error rather than propagating the raw provider exception.
    await expect(searchProviders(makeContext(app, job))).rejects.toThrow(/No releases found/);
  });
});
