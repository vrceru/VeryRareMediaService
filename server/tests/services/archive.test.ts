import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { extractArchive, isArchive } from "../../src/services/archive/index.js";

describe("archive service", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-archive-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("isArchive recognizes .zip and rejects other extensions", () => {
    expect(isArchive("release.zip")).toBe(true);
    expect(isArchive("movie.mkv")).toBe(false);
  });

  it("extracts a zip's files into the destination directory", async () => {
    const zip = new AdmZip();
    zip.addFile("movie.mkv", Buffer.from("fake video bytes"));
    zip.addFile("subs/movie.srt", Buffer.from("1\n00:00:01 --> 00:00:02\nHi"));
    const archivePath = join(workDir, "release.zip");
    zip.writeZip(archivePath);

    const destDir = join(workDir, "out");
    const extracted = await extractArchive(archivePath, destDir);

    expect(extracted).toHaveLength(2);
    const movieContent = await readFile(join(destDir, "movie.mkv"), "utf8");
    expect(movieContent).toBe("fake video bytes");
  });

  it("throws for unsupported archive extensions", async () => {
    await expect(extractArchive(join(workDir, "file.7z"), workDir)).rejects.toThrow(
      /No archive extractor registered/,
    );
  });
});
