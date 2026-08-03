import { describe, it, expect, vi } from "vitest";
import { updateJellyfin } from "../../../src/pipeline/stages/updateJellyfin.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";
import type { JellyfinClient } from "../../../src/integrations/jellyfin/client.js";

class FakeJellyfin {
  notifyPathUpdatedCalls: string[] = [];
  refreshLibraryCalls = 0;
  shouldFail = false;

  async notifyPathUpdated(path: string): Promise<void> {
    if (this.shouldFail) throw new Error("connection refused");
    this.notifyPathUpdatedCalls.push(path);
  }
  async refreshLibrary(): Promise<void> {
    if (this.shouldFail) throw new Error("connection refused");
    this.refreshLibraryCalls++;
  }
}

describe("updateJellyfin stage", () => {
  it("skips when Jellyfin isn't configured", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    await expect(updateJellyfin(makeContext(app, job))).resolves.toBeUndefined();
  });

  it("notifies the specific path when one is known", async () => {
    const fake = new FakeJellyfin();
    const { app, queue } = createTestApp({ jellyfin: fake as unknown as JellyfinClient });
    const job = createRunningJob(queue, { title: "Movie" });
    const ctx = makeContext(app, job, { destinationPath: "/library/movies/Movie (2020)/Movie (2020).mkv" });

    await updateJellyfin(ctx);

    expect(fake.notifyPathUpdatedCalls).toEqual(["/library/movies/Movie (2020)/Movie (2020).mkv"]);
    expect(fake.refreshLibraryCalls).toBe(0);
  });

  it("falls back to a full library refresh when no path is known", async () => {
    const fake = new FakeJellyfin();
    const { app, queue } = createTestApp({ jellyfin: fake as unknown as JellyfinClient });
    const job = createRunningJob(queue, { title: "Movie" });

    await updateJellyfin(makeContext(app, job));

    expect(fake.refreshLibraryCalls).toBe(1);
  });

  it("does not throw when Jellyfin is unreachable — the job's file is already organized", async () => {
    const fake = new FakeJellyfin();
    fake.shouldFail = true;
    const { app, queue } = createTestApp({ jellyfin: fake as unknown as JellyfinClient });
    const job = createRunningJob(queue, { title: "Movie" });

    await expect(updateJellyfin(makeContext(app, job))).resolves.toBeUndefined();
  });

  it("dispatches a library.updated notification on success", async () => {
    const fake = new FakeJellyfin();
    const { app, queue } = createTestApp({ jellyfin: fake as unknown as JellyfinClient });
    const job = createRunningJob(queue, { title: "Movie" });
    const dispatchSpy = vi.spyOn(app.notifications, "dispatch");

    await updateJellyfin(makeContext(app, job));

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "library.updated" }));
  });
});
