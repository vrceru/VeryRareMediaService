import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { parseReleaseName } from "../../services/releaseParsing/releaseParser.js";
import { computeQualityScore } from "../../services/releaseParsing/qualityScore.js";
import { computeRelevanceScore } from "../../services/releaseParsing/relevanceScore.js";

export const STAGE = "select_release";

/**
 * Ranks candidates by blending three signals: the provider's own heuristic (e.g. seeder
 * count), the technical quality parsed from the release name (resolution/source/codec), and
 * how well the parsed name matches the request's explicit year/season/episode. Parsing every
 * candidate's title also gives later stages (identify_media, fetch_metadata) a head start —
 * the winning ParsedRelease is stashed in pipeline state.
 */
export async function selectRelease(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Selecting best release");

  const candidates = ctx.state.releaseCandidates ?? [];
  if (candidates.length === 0) {
    throw new PipelineStageError(STAGE, "No release candidates to select from");
  }

  const ranked = candidates
    .map((candidate) => {
      const parsed = parseReleaseName(candidate.title);
      const qualityScore = computeQualityScore(parsed);
      const relevanceScore = computeRelevanceScore(parsed, ctx.job.request);
      const combinedScore = candidate.qualityScore * 0.4 + qualityScore * 0.4 + relevanceScore * 0.2;
      return { candidate, parsed, combinedScore };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);

  const winner = ranked[0]!;

  const provider = ctx.app.downloadProviders.get(winner.candidate.providerId);
  if (!provider) {
    throw new PipelineStageError(STAGE, `Unknown download provider "${winner.candidate.providerId}"`);
  }

  ctx.state.selectedRelease = winner.candidate;
  ctx.state.parsedRelease = winner.parsed;
  ctx.state.downloadProvider = provider;
  ctx.app.queue.setSelectedRelease(ctx.job.id, winner.candidate);
  ctx.app.queue.updateStage(
    ctx.job.id,
    STAGE,
    `Selected "${winner.candidate.title}" (${winner.candidate.seeders ?? 0} seeders, ` +
      `${winner.parsed.resolution ?? "unknown res"}, ${winner.parsed.source ?? "unknown source"})`,
  );
}
