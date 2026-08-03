import { describe, it, expect } from "vitest";
import { fetchMetadata } from "../../../src/pipeline/stages/fetchMetadata.js";
import { createTestApp, createRunningJob, makeContext, FakeMetadataProvider } from "../fixtures.js";

describe("fetchMetadata stage", () => {
  it("throws when the job has no identified media type", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(fetchMetadata(makeContext(app, job))).rejects.toThrow(/must be identified/);
  });

  it("throws when the matching metadata provider isn't configured", async () => {
    const provider = new FakeMetadataProvider("movie");
    provider.configured = false;
    const { app, queue } = createTestApp({ metadataProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });
    job.mediaType = "movie";
    await expect(fetchMetadata(makeContext(app, job))).rejects.toThrow(/not configured/);
  });

  it("throws when the provider returns no search results", async () => {
    const provider = new FakeMetadataProvider("movie");
    provider.searchResults = [];
    const { app, queue } = createTestApp({ metadataProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });
    job.mediaType = "movie";
    await expect(fetchMetadata(makeContext(app, job))).rejects.toThrow(/No metadata found/);
  });

  it("picks the search result matching the requested year", async () => {
    const provider = new FakeMetadataProvider("movie");
    provider.searchResults = [
      { externalId: "1", title: "Movie", year: 1999 },
      { externalId: "2", title: "Movie", year: 2020 },
    ];
    provider.details = { provider: "fake", externalId: "2", title: "Movie", year: 2020, genres: [] };
    const { app, queue } = createTestApp({ metadataProvider: provider });
    const job = createRunningJob(queue, { title: "Movie", year: 2020 });
    job.mediaType = "movie";

    const ctx = makeContext(app, job);
    await fetchMetadata(ctx);

    expect(ctx.state.metadata?.externalId).toBe("2");
  });

  it("falls back to the parsed release's season/episode when the request didn't specify them", async () => {
    const provider = new FakeMetadataProvider("show");
    provider.searchResults = [{ externalId: "1", title: "Show" }];
    provider.details = { provider: "fake", externalId: "1", title: "Show", genres: [] };
    const { app, queue } = createTestApp({ metadataProvider: provider });
    const job = createRunningJob(queue, { title: "Show" }); // no season/episode on the request
    job.mediaType = "show";

    const ctx = makeContext(app, job, {
      parsedRelease: { title: "Show", season: 3, episode: 7, isProper: false, isRepack: false },
    });
    await fetchMetadata(ctx);

    expect(ctx.state.metadata?.season).toBe(3);
    expect(ctx.state.metadata?.episode).toBe(7);
  });

  it("uses metadataId directly, bypassing search entirely, when the request supplies one", async () => {
    const provider = new FakeMetadataProvider("movie");
    // Deliberately mismatched search results — proves the search path is never consulted.
    provider.searchResults = [{ externalId: "wrong-id", title: "Different Movie", year: 1980 }];
    provider.details = { provider: "fake", externalId: "42", title: "Exact Match", year: 2020, genres: [] };
    const { app, queue } = createTestApp({ metadataProvider: provider });
    const job = createRunningJob(queue, { title: "Movie", metadataId: "42" });
    job.mediaType = "movie";

    const ctx = makeContext(app, job);
    await fetchMetadata(ctx);

    expect(ctx.state.metadata?.externalId).toBe("42");
    expect(ctx.state.metadata?.title).toBe("Exact Match");
    expect(ctx.state.metadataSearchResults).toBeUndefined();
  });

  it("prefers the request's explicit season/episode over the parsed release's", async () => {
    const provider = new FakeMetadataProvider("show");
    provider.searchResults = [{ externalId: "1", title: "Show" }];
    provider.details = { provider: "fake", externalId: "1", title: "Show", genres: [] };
    const { app, queue } = createTestApp({ metadataProvider: provider });
    const job = createRunningJob(queue, { title: "Show", season: 1, episode: 1 });
    job.mediaType = "show";

    const ctx = makeContext(app, job, {
      parsedRelease: { title: "Show", season: 9, episode: 9, isProper: false, isRepack: false },
    });
    await fetchMetadata(ctx);

    expect(ctx.state.metadata?.season).toBe(1);
    expect(ctx.state.metadata?.episode).toBe(1);
  });
});
