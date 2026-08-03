import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { AppContext } from "../appContext.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireApiKey } from "./middleware/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerQueueRoutes } from "./routes/queue.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerHistoryRoutes } from "./routes/history.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerApprovalRoutes } from "./routes/approvals.js";

export async function buildServer(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  app.setErrorHandler(errorHandler);

  // Health lives in its own unauthenticated plugin instance — monitoring/Docker healthchecks
  // shouldn't need an API key, and everything else does when one is configured.
  app.register(
    async (publicApi) => {
      registerHealthRoutes(publicApi, ctx);
    },
    { prefix: "/api" },
  );

  app.register(
    async (privateApi) => {
      if (ctx.config.server.apiKey) {
        privateApi.addHook("preHandler", requireApiKey(ctx.config.server.apiKey));
      }
      registerQueueRoutes(privateApi, ctx);
      registerJobRoutes(privateApi, ctx);
      registerHistoryRoutes(privateApi, ctx);
      registerConfigRoutes(privateApi, ctx);
      registerStatsRoutes(privateApi, ctx);
      registerNotificationRoutes(privateApi, ctx);
      registerLibraryRoutes(privateApi, ctx);
      registerApprovalRoutes(privateApi, ctx);
    },
    { prefix: "/api" },
  );

  return app;
}
