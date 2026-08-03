import "dotenv/config";
import { loadConfig, describeIntegrations, ConfigError } from "./config/index.js";
import { initLogger, getLogger } from "./logging/logger.js";
import { createDb } from "./db/client.js";
import { createAppContext } from "./appContext.js";
import { JobWorker } from "./queue/worker.js";
import { runPipeline } from "./pipeline/runner.js";
import { buildServer } from "./api/server.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const logger = initLogger(config.logging.level, config.logging.pretty);
  logger.info("Starting VeryRare Media Service");
  for (const line of describeIntegrations(config)) logger.info(line);

  const db = createDb(config.database.path);
  const app = createAppContext(config, db);

  const worker = new JobWorker(app.queue, (job) => runPipeline(app, job), {
    concurrency: config.queue.concurrency,
    pollIntervalMs: config.queue.pollIntervalMs,
  });
  worker.start();

  const server = await buildServer(app);
  await server.listen({ port: config.server.port, host: config.server.host });
  logger.info({ port: config.server.port, host: config.server.host }, "API server listening");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    worker.stop();
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  getLogger().fatal({ err }, "fatal startup error");
  process.exit(1);
});
