import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateMediaFile } from "../../src/services/validation/mediaValidator.js";

describe("validateMediaFile", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-validate-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("rejects files below the minimum video size", async () => {
    const file = join(workDir, "movie.mkv");
    await writeFile(file, Buffer.alloc(1024));
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.kind).toBe("video");
  });

  it("rejects filenames that look like samples", async () => {
    const file = join(workDir, "movie.sample.mkv");
    await writeFile(file, Buffer.alloc(30 * 1024 * 1024));
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/sample/i);
  });

  it("accepts a large, non-sample video file", async () => {
    const file = join(workDir, "movie.mkv");
    await writeFile(file, Buffer.alloc(25 * 1024 * 1024));
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("video");
  });

  it("rejects unrecognized extensions", async () => {
    const file = join(workDir, "notes.txt");
    await writeFile(file, "hello");
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.kind).toBe("unknown");
  });

  it("reports invalid for a missing file", () => {
    const result = validateMediaFile(join(workDir, "missing.mkv"));
    expect(result.valid).toBe(false);
  });
});
