import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../appContext.js";
import { directorySizeBytes } from "../../services/cleanup/tempStorage.js";

/** Dashboard-prep endpoint: everything a future UI needs in one call. */
export function registerStatsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/stats", async () => {
    const counts = ctx.queue.countByStatus();
    const activeJobs = ctx.queue.listJobs({ status: "running", limit: 50 });
    const failedJobs = ctx.queue.listJobs({ status: "failed", limit: 20 });

    const activeJobsWithSpeed = await Promise.all(
      activeJobs.map(async (job) => {
        if (job.stage !== "download" || !job.downloadProviderId || !job.downloadRef) {
          return { ...job, downloadSpeedBytesPerSec: null as number | null };
        }
        const provider = ctx.downloadProviders.get(job.downloadProviderId);
        if (!provider) return { ...job, downloadSpeedBytesPerSec: null };
        try {
          const status = await provider.getStatus(job.downloadRef);
          return { ...job, downloadSpeedBytesPerSec: status.downloadSpeedBytesPerSec };
        } catch {
          return { ...job, downloadSpeedBytesPerSec: null };
        }
      }),
    );

    const [tempBytes, movieBytes, showBytes, animeBytes, musicBytes] = await Promise.all([
      directorySizeBytes(ctx.config.storage.downloadTempDir),
      directorySizeBytes(ctx.config.storage.libraryDirs.movie),
      directorySizeBytes(ctx.config.storage.libraryDirs.show),
      directorySizeBytes(ctx.config.storage.libraryDirs.anime),
      directorySizeBytes(ctx.config.storage.libraryDirs.music),
    ]);

    return {
      queueStatus: counts,
      activeJobs: activeJobsWithSpeed,
      recentActivity: ctx.queue.recentHistory(25),
      errorHistory: failedJobs,
      storageUsageBytes: {
        temp: tempBytes,
        movies: movieBytes,
        shows: showBytes,
        anime: animeBytes,
        music: musicBytes,
      },
    };
  });
}
