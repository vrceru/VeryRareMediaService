import { describe, it, expect } from "vitest";
import { identifyMedia } from "../../../src/pipeline/stages/identifyMedia.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("identifyMedia stage", () => {
  it("uses the request's explicit mediaType when present", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Some Music", mediaType: "music" });
    const ctx = makeContext(app, job);
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("music");
  });

  it("infers music from the primary media file's audio extension", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Some Album" });
    const ctx = makeContext(app, job, { primaryMediaFile: "/downloads/track.flac" });
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("music");
  });

  it("infers anime from a leading fansub group in the parsed release", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "[SubsPlease] Show Name - 05 [1080p]" });
    const ctx = makeContext(app, job, {
      parsedRelease: {
        title: "Show Name",
        episode: 5,
        releaseGroup: "SubsPlease",
        groupStyle: "prefix",
        isProper: false,
        isRepack: false,
      },
    });
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("anime");
  });

  it("infers show from a parsed season/episode pair", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Show.Name.S02E05.1080p.WEB-DL-GROUP" });
    const ctx = makeContext(app, job, {
      parsedRelease: {
        title: "Show Name",
        season: 2,
        episode: 5,
        isProper: false,
        isRepack: false,
      },
    });
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("show");
  });

  it("falls back to show via a raw-title regex when there's no parsed release", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Show.Name.S02E05.1080p.WEB-DL" });
    const ctx = makeContext(app, job);
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("show");
  });

  it("defaults to movie when nothing else matches", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Some Random Movie Title" });
    const ctx = makeContext(app, job);
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("movie");
  });

  it("upgrades an explicit \"show\" request to \"anime\" once the release reveals a fansub prefix", async () => {
    // The Discord bot's request search is backed by TMDB, which has no "anime" category, so it
    // always sends "show" for anime titles too. Once the actual selected release is visible
    // (e.g. after searchProviders/selectRelease), the fansub-group heuristic should still be
    // allowed to upgrade it.
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Akame ga Kill!", mediaType: "show" });
    const ctx = makeContext(app, job, {
      parsedRelease: {
        title: "Akame ga Kill!",
        releaseGroup: "Judas",
        groupStyle: "prefix",
        isProper: false,
        isRepack: false,
      },
    });
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("anime");
  });

  it("drops a TMDB-sourced metadataId when upgrading to anime, so fetchMetadata falls back to search", async () => {
    // metadataId on a "show" request is a TMDB ID (that's the bot's only search source) --
    // meaningless once fetchMetadata looks this job up against AniList instead.
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Akame ga Kill!", mediaType: "show", metadataId: "61223" });
    const ctx = makeContext(app, job, {
      parsedRelease: {
        title: "Akame ga Kill!",
        releaseGroup: "Judas",
        groupStyle: "prefix",
        isProper: false,
        isRepack: false,
      },
    });
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("anime");
    expect(job.request.metadataId).toBeUndefined();
  });

  it("does not override an explicit non-\"show\" request even with an anime-style release", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Some Anime Movie", mediaType: "movie" });
    const ctx = makeContext(app, job, {
      parsedRelease: {
        title: "Some Anime Movie",
        releaseGroup: "Judas",
        groupStyle: "prefix",
        isProper: false,
        isRepack: false,
      },
    });
    await identifyMedia(ctx);
    expect(job.mediaType).toBe("movie");
  });

  it("persists the identified media type on the job record", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Some Movie" });
    await identifyMedia(makeContext(app, job));
    expect(queue.getJob(job.id)?.mediaType).toBe("movie");
  });
});
