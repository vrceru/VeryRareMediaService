import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../appContext.js";

export function registerNotificationRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/notifications/test", async () => {
    await ctx.notifications.dispatch({
      type: "queue.finished",
      title: "VRMS test notification",
      message: "If you can see this, notifications are configured correctly.",
    });
    return { sent: true };
  });
}
