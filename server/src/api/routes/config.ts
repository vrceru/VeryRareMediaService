import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../appContext.js";

/** Read-only, secret-free view of the active configuration — never exposes API keys/passwords. */
export function registerConfigRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/config", async () => {
    const { config } = ctx;
    return {
      server: { port: config.server.port, host: config.server.host, nodeEnv: config.server.nodeEnv },
      queue: config.queue,
      storage: config.storage,
      naming: config.naming,
      virusScan: { enabled: config.virusScan.enabled },
      integrations: {
        qbittorrent: config.qbittorrent ? { url: config.qbittorrent.url, configured: true } : { configured: false },
        sabnzbd: config.sabnzbd ? { url: config.sabnzbd.url, configured: true } : { configured: false },
        newznab: config.newznab ? { url: config.newznab.url, configured: true } : { configured: false },
        youtube: { configured: config.youtube !== undefined },
        tmdb: { configured: config.tmdb !== undefined },
        jellyfin: config.jellyfin ? { url: config.jellyfin.url, configured: true } : { configured: false },
        discord: { configured: config.discord !== undefined },
        webhookCount: config.webhookUrls.length,
        apiAuth: { configured: config.server.apiKey !== undefined },
      },
    };
  });
}
