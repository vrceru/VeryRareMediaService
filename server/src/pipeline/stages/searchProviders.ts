import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";

export const STAGE = "search_providers";

export async function searchProviders(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Searching configured download providers");

  const preferredProviderId = ctx.job.request.preferredProviderId;
  let configured = ctx.app.downloadProviders.listConfigured();

  if (preferredProviderId) {
    const preferred = ctx.app.downloadProviders.get(preferredProviderId);
    if (!preferred || !preferred.isConfigured()) {
      throw new PipelineStageError(
        STAGE,
        `Requested provider "${preferredProviderId}" is not configured`,
      );
    }
    configured = [preferred];
  }

  if (configured.length === 0) {
    throw new PipelineStageError(STAGE, "No download providers are configured");
  }

  const query = ctx.job.request.searchQuery ?? ctx.job.request.title;
  const results = (
    await Promise.all(
      configured.map((provider) =>
        provider.search({ query, category: ctx.job.request.mediaType }).catch((err) => {
          ctx.app.logger.warn(
            { provider: provider.id, err: err instanceof Error ? err.message : err },
            "provider search failed",
          );
          return [];
        }),
      ),
    )
  ).flat();

  if (results.length === 0) {
    throw new PipelineStageError(STAGE, `No releases found for "${query}"`);
  }

  ctx.state.releaseCandidates = results;
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Found ${results.length} candidate release(s)`);
}
