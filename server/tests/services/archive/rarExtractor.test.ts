import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isArchive, extractArchive } from "../../../src/services/archive/index.js";
import { RarExtractor } from "../../../src/services/archive/rarExtractor.js";

// NOTE: there's no rar/7z tooling available in this environment to generate a real .rar
// fixture, and fetching one from the network wasn't done without asking first. These tests
// cover extension routing and error handling for real; true round-trip extraction against a
// well-formed .rar should be smoke-tested against a real release once this ships.
describe("RarExtractor", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-rar-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("isArchive recognizes .rar", () => {
    expect(isArchive("release.rar")).toBe(true);
  });

  it("routes .rar files to RarExtractor via the shared registry", async () => {
    const badRar = join(workDir, "broken.rar");
    await writeFile(badRar, "not a real rar file");

    // A corrupt/non-RAR file should fail with an unrar-originated error, not "no extractor
    // registered" — proves the extension routing reaches RarExtractor.
    await expect(extractArchive(badRar, join(workDir, "out"))).rejects.toThrow();
    await expect(extractArchive(badRar, join(workDir, "out"))).rejects.not.toThrow(
      /No archive extractor registered/,
    );
  });

  it("throws when the archive file doesn't exist", async () => {
    const extractor = new RarExtractor();
    await expect(extractor.extract(join(workDir, "missing.rar"), join(workDir, "out"))).rejects.toThrow();
  });
});
