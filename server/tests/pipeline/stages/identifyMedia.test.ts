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

  it("persists the identified media type on the job record", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Some Movie" });
    await identifyMedia(makeContext(app, job));
    expect(queue.getJob(job.id)?.mediaType).toBe("movie");
  });
});
