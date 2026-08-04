import { describe, it, expect } from "vitest";
import { selectRelease } from "../../../src/pipeline/stages/selectRelease.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext, FakeDownloadProvider } from "../fixtures.js";
import type { ReleaseCandidate } from "../../../src/providers/download/types.js";

describe("selectRelease stage", () => {
  it("throws when there are no candidates", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(selectRelease(makeContext(app, job, { releaseCandidates: [] }))).rejects.toThrow(
      PipelineStageError,
    );
  });

  it("throws when a candidate references an unknown provider", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const candidates: ReleaseCandidate[] = [
      { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 1, qualityScore: 0.5, providerId: "nonexistent" },
    ];
    await expect(selectRelease(makeContext(app, job, { releaseCandidates: candidates }))).rejects.toThrow(
      /Unknown download provider/,
    );
  });

  it("picks the higher-quality release over a higher-seeder low-quality one", async () => {
    const provider = new FakeDownloadProvider();
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });

    const candidates: ReleaseCandidate[] = [
      { id: "cam", title: "Movie.2020.480p.CAM.XviD-GROUP", sizeBytes: 1, qualityScore: 0.95, providerId: provider.id },
      { id: "bluray", title: "Movie.2020.2160p.BluRay.HEVC-GROUP", sizeBytes: 1, qualityScore: 0.4, providerId: provider.id },
    ];

    const ctx = makeContext(app, job, { releaseCandidates: candidates });
    await selectRelease(ctx);

    expect(ctx.state.selectedRelease?.id).toBe("bluray");
    expect(ctx.state.parsedRelease?.resolution).toBe("2160p");
    expect(ctx.state.downloadProvider).toBe(provider);
  });

  it("prefers a release matching the requested season/episode via relevance scoring", async () => {
    const provider = new FakeDownloadProvider();
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Show", season: 2, episode: 5 });

    const candidates: ReleaseCandidate[] = [
      { id: "wrong", title: "Show.S01E01.1080p.WEB-DL-GROUP", sizeBytes: 1, qualityScore: 0.6, providerId: provider.id },
      { id: "right", title: "Show.S02E05.1080p.WEB-DL-GROUP", sizeBytes: 1, qualityScore: 0.6, providerId: provider.id },
    ];

    const ctx = makeContext(app, job, { releaseCandidates: candidates });
    await selectRelease(ctx);

    expect(ctx.state.selectedRelease?.id).toBe("right");
  });

  it("excludes a release already proven dead by a previous attempt of this job", async () => {
    // Regression test: a fake-seeded release can dominate scoring on every retry unless a
    // proven-dead one is actually excluded, not just re-ranked.
    const provider = new FakeDownloadProvider();
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });

    const candidates: ReleaseCandidate[] = [
      {
        id: "fake-seeded",
        title: "Movie.2020.720p.BrRip-GROUP",
        sizeBytes: 1,
        qualityScore: 0.99,
        providerId: provider.id,
        dedupeKey: "hash-x",
      },
      { id: "real", title: "Movie.2020.1080p.BluRay-GROUP", sizeBytes: 1, qualityScore: 0.3, providerId: provider.id },
    ];

    queue.markReleaseDead(job.id, "hash-x");
    const refreshedJob = queue.getJob(job.id)!;

    const ctx = makeContext(app, refreshedJob, { releaseCandidates: candidates });
    await selectRelease(ctx);

    expect(ctx.state.selectedRelease?.id).toBe("real");
  });

  it("falls back to the full candidate list when every candidate is already dead", async () => {
    const provider = new FakeDownloadProvider();
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });

    const candidates: ReleaseCandidate[] = [
      {
        id: "only",
        title: "Movie.2020.720p-GROUP",
        sizeBytes: 1,
        qualityScore: 0.5,
        providerId: provider.id,
        dedupeKey: "hash-only",
      },
    ];

    queue.markReleaseDead(job.id, "hash-only");
    const refreshedJob = queue.getJob(job.id)!;

    const ctx = makeContext(app, refreshedJob, { releaseCandidates: candidates });
    await selectRelease(ctx);

    expect(ctx.state.selectedRelease?.id).toBe("only");
  });

  it("persists the selected release onto the job record", async () => {
    const provider = new FakeDownloadProvider();
    const { app, queue } = createTestApp({ downloadProvider: provider });
    const job = createRunningJob(queue, { title: "Movie" });
    const candidates: ReleaseCandidate[] = [
      { id: "a", title: "Movie.2020.1080p-GROUP", sizeBytes: 1, qualityScore: 0.5, providerId: provider.id },
    ];

    await selectRelease(makeContext(app, job, { releaseCandidates: candidates }));

    const persisted = queue.getJob(job.id);
    expect(persisted?.selectedRelease).toMatchObject({ id: "a" });
  });
});
