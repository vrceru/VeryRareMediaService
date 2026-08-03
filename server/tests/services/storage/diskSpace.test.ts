import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getFreeBytes, checkSpace } from "../../../src/services/storage/diskSpace.js";

describe("diskSpace", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "vrms-diskspace-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("getFreeBytes returns a positive number for a real path", async () => {
    const free = await getFreeBytes(workDir);
    expect(free).toBeGreaterThan(0);
  });

  it("checkSpace reports enough space for a tiny requirement", async () => {
    const result = await checkSpace(workDir, 1024);
    expect(result.hasEnoughSpace).toBe(true);
    expect(result.requiredBytes).toBe(1024);
    expect(result.freeBytes).toBeGreaterThan(0);
  });

  it("checkSpace reports not enough space for an absurd requirement", async () => {
    const result = await checkSpace(workDir, Number.MAX_SAFE_INTEGER);
    expect(result.hasEnoughSpace).toBe(false);
  });

  it("getFreeBytes rejects for a path that doesn't exist", async () => {
    await writeFile(join(workDir, "marker"), "x"); // ensure workDir itself is real
    await expect(getFreeBytes(join(workDir, "does-not-exist"))).rejects.toThrow();
  });
});
