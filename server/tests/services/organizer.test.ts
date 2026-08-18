import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeDestinationPath,
  computeDestinationPaths,
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

describe("computeDestinationPaths (batch/season-pack releases)", () => {
  let workDir: string;
  let libraryDirs: Record<"movie" | "show" | "anime" | "music", string>;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-organizer-batch-"));
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

  it("parses a per-file episode number from each filename in an anime season pack", async () => {
    const dir = join(workDir, "[Judas] Show (Season 1)");
    await mkdir(dir, { recursive: true });
    const files = ["[Judas] Show - 01.mkv", "[Judas] Show - 02.mkv", "[Judas] Show - 16.mkv"];
    for (const f of files) await writeFile(join(dir, f), "fake video");

    const metadata: MediaMetadata = { provider: "anilist", externalId: "1", title: "Show", genres: [] };
    const results = await computeDestinationPaths({
      sourceFilePaths: files.map((f) => join(dir, f)),
      mediaType: "anime",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(results).toHaveLength(3);
    expect(results[0]!.destination).toContain(join("Show", "Season 01", "Show - S01E01.mkv"));
    expect(results[1]!.destination).toContain(join("Show", "Season 01", "Show - S01E02.mkv"));
    expect(results[2]!.destination).toContain(join("Show", "Season 01", "Show - S01E16.mkv"));
  });

  it("never assigns two files in the same batch the same destination", async () => {
    const dir = join(workDir, "src");
    await mkdir(dir, { recursive: true });
    // Neither filename carries a parseable episode number, so both would fall back to the same
    // series-level metadata (no episode token) without the in-batch collision guard.
    const files = ["episode-a.mkv", "episode-b.mkv"];
    for (const f of files) await writeFile(join(dir, f), "fake video");

    const metadata: MediaMetadata = { provider: "anilist", externalId: "1", title: "Show", genres: [] };
    const results = await computeDestinationPaths({
      sourceFilePaths: files.map((f) => join(dir, f)),
      mediaType: "anime",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(results[0]!.destination).not.toBe(results[1]!.destination);
  });

  it("parses a per-file track number from each filename in a multi-track album", async () => {
    const dir = join(workDir, "Artist - Album [FLAC]");
    await mkdir(dir, { recursive: true });
    const files = ["01 - First Song.flac", "02. Second Song.flac", "10_Tenth Song.flac"];
    for (const f of files) await writeFile(join(dir, f), "fake audio");

    const metadata: MediaMetadata = {
      provider: "musicbrainz",
      externalId: "1",
      title: "Album",
      album: "Album",
      artist: "Artist",
      year: 2020,
      genres: [],
    };
    const results = await computeDestinationPaths({
      sourceFilePaths: files.map((f) => join(dir, f)),
      mediaType: "music",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(results).toHaveLength(3);
    expect(results[0]!.destination).toContain(join("Artist", "Album (2020)", "01 - Album.flac"));
    expect(results[1]!.destination).toContain(join("Artist", "Album (2020)", "02 - Album.flac"));
    expect(results[2]!.destination).toContain(join("Artist", "Album (2020)", "10 - Album.flac"));
  });

  it("never collides two untagged tracks onto the same destination", async () => {
    const dir = join(workDir, "src");
    await mkdir(dir, { recursive: true });
    const files = ["trackA.flac", "trackB.flac"];
    for (const f of files) await writeFile(join(dir, f), "fake audio");

    const metadata: MediaMetadata = {
      provider: "musicbrainz",
      externalId: "1",
      title: "Album",
      album: "Album",
      artist: "Artist",
      genres: [],
    };
    const results = await computeDestinationPaths({
      sourceFilePaths: files.map((f) => join(dir, f)),
      mediaType: "music",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(results[0]!.destination).not.toBe(results[1]!.destination);
  });

  it("leaves movie naming untouched by the per-file episode logic", async () => {
    const source = join(workDir, "Movie.Title.2020.mkv");
    await writeFile(source, "fake video");

    const metadata: MediaMetadata = { provider: "tmdb-movie", externalId: "1", title: "Movie Title", year: 2020, genres: [] };
    const results = await computeDestinationPaths({
      sourceFilePaths: [source],
      mediaType: "movie",
      metadata,
      namingTemplates,
      libraryDirs,
    });

    expect(results[0]!.destination).toContain(join("Movie Title (2020)", "Movie Title (2020).mkv"));
  });
});

describe("PathTraversalError export sanity", () => {
  it("is a distinguishable Error subclass", () => {
    const err = new PathTraversalError("../x", "/root");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PathTraversalError");
  });
});
