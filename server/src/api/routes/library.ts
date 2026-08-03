import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../appContext.js";
import { BadRequestError } from "../middleware/errorHandler.js";

export function registerLibraryRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/library/refresh", async () => {
    if (!ctx.jellyfin) throw new BadRequestError("Jellyfin is not configured");
    await ctx.jellyfin.refreshLibrary();
    return { refreshed: true };
  });

  app.get("/library/test-connection", async () => {
    if (!ctx.jellyfin) return { configured: false, connected: false };
    const connected = await ctx.jellyfin.testConnection();
    return { configured: true, connected };
  });
}
