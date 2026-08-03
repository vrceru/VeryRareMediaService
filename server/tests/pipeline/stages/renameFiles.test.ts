import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renameFiles } from "../../../src/pipeline/stages/renameFiles.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("renameFiles stage", () => {
  let workDir: string;
  let libraryDirs: { movie: string; show: string; anime: string; music: string };

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-rename-"));
    libraryDirs = {
      movie: join(workDir, "library", "movies"),
      show: join(workDir, "library", "shows"),
      anime: join(workDir, "library", "anime"),
      music: join(workDir, "library", "music"),
    };
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("throws when primaryMediaFile, metadata, or mediaType is missing", async () => {
    const { app, queue } = createTestApp({ libraryDirs });
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(renameFiles(makeContext(app, job))).rejects.toThrow(PipelineStageError);
  });

  it("computes a sanitized destination path from the naming template", async () => {
    const source = join(workDir, "download.mkv");
    await writeFile(source, "content");

    const { app, queue } = createTestApp({ libraryDirs });
    const job = createRunningJob(queue, { title: "Movie" });
    job.mediaType = "movie";

    const ctx = makeContext(app, job, {
      primaryMediaFile: source,
      metadata: { provider: "fake", externalId: "1", title: "My Movie", year: 2020, genres: [] },
    });
    await renameFiles(ctx);

    expect(ctx.state.destinationPath).toBe(
      join(libraryDirs.movie, "My Movie (2020)", "My Movie (2020).mkv"),
    );
  });
});
