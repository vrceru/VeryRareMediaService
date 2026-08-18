import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { parseYoutubeTitle } from "../../services/musicMatching/parseYoutubeTitle.js";
import { scoreCandidates } from "../../services/musicMatching/scoreMatch.js";

export const STAGE = "fetch_metadata";

export async function fetchMetadata(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Fetching metadata");

  const mediaType = ctx.job.mediaType;
  if (!mediaType) {
    throw new PipelineStageError(STAGE, "Media type must be identified before fetching metadata");
  }

  const provider = ctx.app.metadataProviders.get(mediaType);
  if (!provider.isConfigured()) {
    throw new PipelineStageError(
      STAGE,
      `Metadata provider "${provider.id}" is not configured for media type "${mediaType}"`,
    );
  }

  const { title, metadataId } = ctx.job.request;
  const parsed = ctx.state.parsedRelease;
  // Prefer explicit request fields; fall back to what the release name parser found (a user
  // often just requests "Show Name" and the specific season/episode only shows up in whatever
  // release got selected).
  const year = ctx.job.request.year ?? parsed?.year;
  const season = ctx.job.request.season ?? parsed?.season;
  const episode = ctx.job.request.episode ?? parsed?.episode;

  let externalId: string;
  let matchConfidence: number | undefined;

  if (metadataId) {
    // Caller already resolved an exact match (e.g. a bot's own TMDB search UI) — skip the
    // search+best-guess step entirely so we can't land on a different same-titled entry.
    externalId = metadataId;
  } else if (mediaType === "music") {
    // Music titles are frequently noisy (YouTube video titles, torrent release names) rather
    // than a clean, already-normalized title — score every candidate instead of blindly taking
    // the first result. See services/musicMatching.
    const results = await provider.search(title, year);
    ctx.state.metadataSearchResults = results;
    if (results.length === 0) {
      throw new PipelineStageError(STAGE, `No metadata found for "${title}"`);
    }

    const source = parseYoutubeTitle(title);
    const scored = scoreCandidates(source, results, ctx.job.request.durationSeconds);
    const top = scored[0]!;

    const { uncertain } = ctx.app.config.metadataConfidence;
    if (top.score < uncertain) {
      throw new PipelineStageError(
        STAGE,
        `No confident metadata match for "${title}" (best match "${top.candidate.title}" scored ${top.score}, below the ${uncertain} threshold)`,
      );
    }

    externalId = top.candidate.externalId;
    matchConfidence = top.score;
  } else {
    const results = await provider.search(title, year);
    ctx.state.metadataSearchResults = results;

    const best = year ? (results.find((r) => r.year === year) ?? results[0]) : results[0];
    if (!best) {
      throw new PipelineStageError(STAGE, `No metadata found for "${title}"`);
    }
    externalId = best.externalId;
  }

  const details = await provider.getDetails(externalId, { season, episode });
  const metadata = matchConfidence !== undefined ? { ...details, matchConfidence } : details;
  ctx.state.metadata = metadata;
  ctx.app.queue.setMetadata(ctx.job.id, metadata);
  ctx.app.queue.updateStage(
    ctx.job.id,
    STAGE,
    matchConfidence !== undefined
      ? `Matched "${metadata.title}" via ${provider.id} (confidence ${matchConfidence})`
      : `Matched "${metadata.title}" via ${provider.id}`,
  );
}
