import { describe, it, expect, vi } from "vitest";
import { sendNotifications } from "../../../src/pipeline/stages/sendNotifications.js";
import { createTestApp, createRunningJob, makeContext } from "../fixtures.js";

describe("sendNotifications stage", () => {
  it("dispatches queue.finished when this job is the only one active", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    const dispatchSpy = vi.spyOn(app.notifications, "dispatch");

    await sendNotifications(makeContext(app, job));

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "queue.finished" }));
  });

  it("does not dispatch queue.finished while other jobs are still pending", async () => {
    const { app, queue } = createTestApp();
    const job = createRunningJob(queue, { title: "Movie" });
    queue.enqueue({ title: "Another Movie" }); // stays pending

    const dispatchSpy = vi.spyOn(app.notifications, "dispatch");
    await sendNotifications(makeContext(app, job));

    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
