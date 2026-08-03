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

  it("moves every file in a batch (season-pack) release, not just the primary one", async () => {
    const srcDir = join(workDir, "src");
    await mkdir(srcDir, { recursive: true });
    const ep1 = join(srcDir, "ep1.mkv");
    const ep2 = join(srcDir, "ep2.mkv");
    const ep3 = join(srcDir, "ep3.mkv");
    await writeFile(ep1, "a");
    await writeFile(ep2, "bb");
    await writeFile(ep3, "ccc");

    const dest1 = join(libraryDirs.anime, "Show", "Season 01", "Show - S01E01.mkv");
    const dest2 = join(libraryDirs.anime, "Show", "Season 01", "Show - S01E02.mkv");
    const dest3 = join(libraryDirs.anime, "Show", "Season 01", "Show - S01E03.mkv");

    const { app, queue } = createTestApp({ libraryDirs });
    const job = createRunningJob(queue, { title: "Show" });
    job.mediaType = "anime";

    const ctx = makeContext(app, job, {
      primaryMediaFile: ep3,
      destinationPath: dest3,
      destinationPaths: [
        { source: ep1, destination: dest1 },
        { source: ep2, destination: dest2 },
        { source: ep3, destination: dest3 },
      ],
    });
    await organizeLibrary(ctx);

    await expect(access(dest1)).resolves.toBeUndefined();
    await expect(access(dest2)).resolves.toBeUndefined();
    await expect(access(dest3)).resolves.toBeUndefined();
    await expect(access(ep1)).rejects.toThrow();
    expect(ctx.state.organizedItemDir).toBe(dirname(dest3));
  });
});
