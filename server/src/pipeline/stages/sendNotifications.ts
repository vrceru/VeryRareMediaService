import type { PipelineContext } from "../types.js";

export const STAGE = "send_notifications";

/**
 * download.started/completed and library.updated are dispatched by the stages that actually
 * cause them. This stage's job is the queue-level "queue.finished" event: if no other job is
 * pending or running once this one reaches here, the queue has drained.
 */
export async function sendNotifications(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Checking queue drain state");

  const counts = ctx.app.queue.countByStatus();
  const otherActive = counts.pending + counts.running - 1; // exclude this job (still "running")

  if (otherActive <= 0) {
    await ctx.app.notifications.dispatch({
      type: "queue.finished",
      title: "Queue finished",
      message: "All queued jobs have been processed",
    });
  }
}
