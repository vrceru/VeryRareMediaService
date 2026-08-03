import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { extractArchive } from "../../../src/pipeline/stages/extractArchive.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("extractArchive stage", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-extract-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("is a no-op when there are no archives among the media files", async () => {
    const file = join(workDir, "movie.mkv");
    await writeFile(file, "content");

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: [file] });
    await extractArchive(ctx);

    expect(ctx.state.mediaFiles).toEqual([file]);
  });

  it("extracts a zip and replaces it with the extracted files in state", async () => {
    const zip = new AdmZip();
    zip.addFile("movie.mkv", Buffer.from("fake video"));
    const archivePath = join(workDir, "release.zip");
    zip.writeZip(archivePath);
    const otherFile = join(workDir, "readme.txt");
    await writeFile(otherFile, "hi");

    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: [archivePath, otherFile] });
    await extractArchive(ctx);

    expect(ctx.state.mediaFiles).toContain(otherFile);
    expect(ctx.state.mediaFiles).toHaveLength(2);
    expect(ctx.state.mediaFiles!.some((f) => f.endsWith("movie.mkv"))).toBe(true);
    expect(ctx.state.mediaFiles).not.toContain(archivePath);
  });
});
