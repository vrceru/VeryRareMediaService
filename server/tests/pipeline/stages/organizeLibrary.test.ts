import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { organizeLibrary } from "../../../src/pipeline/stages/organizeLibrary.js";
import { PipelineStageError } from "../../../src/pipeline/types.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("organizeLibrary stage", () => {
  let workDir: string;
  let libraryDirs: { movie: string; show: string; anime: string; music: string };

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-organize-"));
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

  it("throws when primaryMediaFile, destinationPath, or mediaType is missing", async () => {
    const { app, queue } = createTestApp({ libraryDirs });
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(organizeLibrary(makeContext(app, job))).rejects.toThrow(PipelineStageError);
  });

  it("moves the file to its computed destination", async () => {
    const source = join(workDir, "download.mkv");
    await writeFile(source, "content");
    const destinationPath = join(libraryDirs.movie, "My Movie (2020)", "My Movie (2020).mkv");

    const { app, queue } = createTestApp({ libraryDirs });
    const job = createRunningJob(queue, { title: "Movie" });
    job.mediaType = "movie";

    const ctx = makeContext(app, job, { primaryMediaFile: source, destinationPath });
    await organizeLibrary(ctx);

    await expect(access(destinationPath)).resolves.toBeUndefined();
    await expect(access(source)).rejects.toThrow();
    expect(ctx.state.organizedItemDir).toBe(dirname(destinationPath));
  });

  it("skips the move and reuses the existing directory when a content-identical duplicate exists", async () => {
    const existingDir = join(libraryDirs.movie, "My Movie (2020)");
    const existingFile = join(existingDir, "My Movie (2020).mkv");
    await mkdir(existingDir, { recursive: true });
    await writeFile(existingFile, "identical content");

    const source = join(workDir, "download.mkv");
    await writeFile(source, "identical content");
    const destinationPath = join(libraryDirs.movie, "My Movie (2020)", "My Movie (2020) (1).mkv");

    const { app, queue } = createTestApp({ libraryDirs });
    const job = createRunningJob(queue, { title: "Movie" });
    job.mediaType = "movie";

    const ctx = makeContext(app, job, { primaryMediaFile: source, destinationPath });
    await organizeLibrary(ctx);

    // Source file untouched, no new file created at the "(1)" path.
    await expect(access(source)).resolves.toBeUndefined();
    await expect(access(destinationPath)).rejects.toThrow();
    expect(ctx.state.organizedItemDir).toBe(existingDir);
  });
});
