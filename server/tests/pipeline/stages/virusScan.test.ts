import { describe, it, expect } from "vitest";
import { virusScan } from "../../../src/pipeline/stages/virusScan.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";
import type { ScanResult, VirusScanner } from "../../../src/services/virusscan/types.js";

class FakeScanner implements VirusScanner {
  constructor(
    private readonly enabled: boolean,
    private readonly results: Record<string, ScanResult>,
  ) {}
  isEnabled(): boolean {
    return this.enabled;
  }
  async scanFile(filePath: string): Promise<ScanResult> {
    return this.results[filePath] ?? { clean: true };
  }
}

describe("virusScan stage", () => {
  it("skips scanning when disabled (the default)", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: ["/downloads/movie.mkv"] });
    await expect(virusScan(ctx)).resolves.toBeUndefined();
  });

  it("passes clean files through when enabled", async () => {
    const scanner = new FakeScanner(true, { "/downloads/movie.mkv": { clean: true } });
    const { app, queue } = createTestApp({ virusScanner: scanner });
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: ["/downloads/movie.mkv"] });
    await expect(virusScan(ctx)).resolves.toBeUndefined();
  });

  it("throws with the signature when a file is infected", async () => {
    const scanner = new FakeScanner(true, {
      "/downloads/movie.mkv": { clean: false, signature: "Eicar-Test-Signature" },
    });
    const { app, queue } = createTestApp({ virusScanner: scanner });
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { mediaFiles: ["/downloads/movie.mkv"] });
    await expect(virusScan(ctx)).rejects.toThrow(/Eicar-Test-Signature/);
  });
});
