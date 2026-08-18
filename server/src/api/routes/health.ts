import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../appContext.js";

export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/health", async () => {
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      integrations: {
        qbittorrent: ctx.downloadProviders.get("qbittorrent")?.isConfigured() ?? false,
        sabnzbd: ctx.downloadProviders.get("sabnzbd")?.isConfigured() ?? false,
        newznab: ctx.config.newznab !== undefined,
        directDownload: ctx.downloadProviders.get("direct-download")?.isConfigured() ?? false,
        youtube: ctx.downloadProviders.get("youtube")?.isConfigured() ?? false,
        tmdb: ctx.config.tmdb !== undefined,
        jellyfin: ctx.jellyfin !== undefined,
        discord: ctx.config.discord !== undefined,
        virusScan: ctx.virusScanner.isEnabled(),
        apiAuth: ctx.config.server.apiKey !== undefined,
      },
    };
  });
}
