import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeDestinationPath,
  moveToDestination,
  organizeFile,
} from "../../src/services/organization/organizer.js";
import type { MediaMetadata } from "../../src/providers/metadata/types.js";
import { PathTraversalError } from "../../src/security/pathSanitizer.js";

const namingTemplates = {
  movie: "{title} ({year})/{title} ({year}){extension}",
  show: "{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded}{extension}",
  anime: "{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded}{extension}",
  music: "{artist}/{album} ({year})/{trackPadded} - {title}{extension}",
};

describe("organizer", () => {
  let workDir: string;
  let libraryDirs: Record<"movie" | "show" | "anime" | "music", string>;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-organizer-"));
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

  it("computes a sanitized, collision-free destination path for a movie", async () => {
    const source = join(workDir, "download.mkv");
    await writeFile(source, "fake video");

    const metadata: MediaMetadata = {
      provider: "tmdb-movie",
      externalId: "1",
      title: "Bad: Title?",
      year: 2020,
      genres: [],
    };

    const dest = await computeDestinationPath({
      sourceFilePath: source,
      mediaType: "movie",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(dest).toContain(join(libraryDirs.movie, "Bad Title (2020)", "Bad Title (2020).mkv"));
  });

  it("neutralizes a naming template that tries to escape the library root", async () => {
    const source = join(workDir, "download.mkv");
    await writeFile(source, "fake video");

    const metadata: MediaMetadata = { provider: "x", externalId: "1", title: "Movie", genres: [] };
    const maliciousTemplates = { ...namingTemplates, movie: "../../../etc/{title}{extension}" };

    // sanitizeRelativePath strips ../ segments before resolveWithinRoot ever sees them, so the
    // result stays inside the library root instead of throwing.
    const dest = await computeDestinationPath({
      sourceFilePath: source,
      mediaType: "movie",
      metadata,
      namingTemplates: maliciousTemplates,
      libraryDirs,
    });
    expect(dest.startsWith(libraryDirs.movie)).toBe(true);
  });

  it("appends (1), (2)... on name collisions", async () => {
    const dest = join(libraryDirs.movie, "Movie (2020)", "Movie (2020).mkv");
    await mkdir(join(libraryDirs.movie, "Movie (2020)"), { recursive: true });
    await writeFile(dest, "existing");

    const source = join(workDir, "new.mkv");
    await writeFile(source, "new file");

    const metadata: MediaMetadata = { provider: "x", externalId: "1", title: "Movie", year: 2020, genres: [] };
    const resolved = await computeDestinationPath({
      sourceFilePath: source,
      mediaType: "movie",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(resolved).toBe(join(libraryDirs.movie, "Movie (2020)", "Movie (2020) (1).mkv"));
  });

  it("moveToDestination creates parent directories and moves the file", async () => {
    const source = join(workDir, "src.mkv");
    await writeFile(source, "content");
    const dest = join(libraryDirs.movie, "Nested", "Dir", "dest.mkv");

    await moveToDestination(source, dest);

    await expect(access(dest)).resolves.toBeUndefined();
    await expect(access(source)).rejects.toThrow();
  });

  it("organizeFile combines compute + move in one call", async () => {
    const source = join(workDir, "combo.mkv");
    await writeFile(source, "content");
    const metadata: MediaMetadata = { provider: "x", externalId: "1", title: "Combo", year: 1999, genres: [] };

    const dest = await organizeFile({
      sourceFilePath: source,
      mediaType: "movie",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    await expect(access(dest)).resolves.toBeUndefined();
  });
});

describe("PathTraversalError export sanity", () => {
  it("is a distinguishable Error subclass", () => {
    const err = new PathTraversalError("../x", "/root");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PathTraversalError");
  });
});
